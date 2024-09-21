let chart;

$(document).ready(function() {
    $('#analysisForm').on('submit', function(e) {
        e.preventDefault();
        const totalCost = parseInt($('#totalCostInput').val().replace(/[^0-9]/g, ''));
        $('#loading').show();
        $('#result').hide();
        $('#error').hide();
        analyzeGlobal(totalCost);
    });
});

function analyzeGlobal(totalCost) {
    const apiUrl = 'https://mon-entreprise.urssaf.fr/api/v1/evaluate';
    const results = [];
    const delay = 500; // 500ms delay between calls

    function makeApiCall(dividends) {
        const salary = totalCost - dividends;
        if (salary < 10000) {
            displayResults(results, totalCost);
            return;
        }

        const salaryData = {
            "expressions": [
                "dirigeant . rémunération . net . après impôt",
                "impôt . revenu imposable",
                "protection sociale . retraite . base",
                "protection sociale . retraite . complémentaire . RCI"
            ],
            "situation": {
                "entreprise . imposition": "'IS'",
                "entreprise . associés": "'unique'",
                "entreprise . catégorie juridique": "'SARL'",
                "dirigeant . rémunération . totale": salary
            }
        };

        $.ajax({
            url: apiUrl,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(salaryData)
        }).done(function(salaryResponse) {
            const netSalaryAfterTax = salaryResponse.evaluate[0].nodeValue;
            const taxableIncome = salaryResponse.evaluate[1].nodeValue;
            const baseRetirementMonthlyAmount = salaryResponse.evaluate[2].nodeValue;
            const complementaryRetirementAmount = salaryResponse.evaluate[3].nodeValue * 43;

            const corporateTax = calculateCorporateTax(dividends);
            const grossDividends = dividends - corporateTax;
            const netDividendsPFU = calculateNetDividendsPFU(grossDividends);
            const totalNetAfterTaxPFU = netSalaryAfterTax + netDividendsPFU;

            const dividendData = {
                "expressions": ["bénéficiaire . dividendes . nets d'impôt"],
                "situation": {
                    "impôt . foyer fiscal . revenu imposable . autres revenus imposables": taxableIncome,
                    "impôt . méthode de calcul": "'barème standard'",
                    "dirigeant . rémunération . net . imposable": "0 €/an",
                    "bénéficiaire": "oui",
                    "entreprise . catégorie juridique": "'SAS'",
                    "bénéficiaire . dividendes . bruts": grossDividends
                }
            };

            $.ajax({
                url: apiUrl,
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(dividendData)
            }).done(function(dividendResponse) {
                const netDividendsProgressive = dividendResponse.evaluate[0].nodeValue;
                const totalNetAfterTaxProgressive = netSalaryAfterTax + netDividendsProgressive;

                results.push({
                    salary: salary,
                    dividends: dividends,
                    netSalaryAfterTax: netSalaryAfterTax,
                    netDividendsPFU: netDividendsPFU,
                    netDividendsProgressive: netDividendsProgressive,
                    totalNetAfterTaxPFU: totalNetAfterTaxPFU,
                    totalNetAfterTaxProgressive: totalNetAfterTaxProgressive,
                    baseRetirementYearlyAmount: baseRetirementMonthlyAmount * 12,
                    complementaryRetirementAmount: complementaryRetirementAmount,
                    totalRetirement: baseRetirementMonthlyAmount * 12 + complementaryRetirementAmount
                });

                // Update progress
                const progress = Math.round((dividends / totalCost) * 100);
                $('#progressBar').css('width', progress + '%').attr('aria-valuenow', progress).text(progress + '%');

                // Make the next call after a delay
                setTimeout(() => makeApiCall(dividends + 10000), delay);
            }).fail(function(jqXHR, textStatus, errorThrown) {
                console.error('Dividend API call failed:', textStatus, errorThrown);
                $('#loading').hide();
                $('#error').show().text('Une erreur est survenue lors de l\'analyse des dividendes. Veuillez réessayer plus tard.');
            });
        }).fail(function(jqXHR, textStatus, errorThrown) {
            console.error('Salary API call failed:', textStatus, errorThrown);
            $('#loading').hide();
            $('#error').show().text('Une erreur est survenue lors de l\'analyse du salaire. Veuillez réessayer plus tard.');
        });
    }

    // Start the API calls from 0€ dividends
    $('#loading').show();
    $('#result').hide();
    $('#error').hide();
    makeApiCall(0);
}

function displayResults(results, totalCost) {
    const labels = results.map(r => r.salary.toLocaleString('fr-FR') + ' €');

    // Destroy existing chart if it exists
    if (chart) chart.destroy();

    // Create the global analysis chart
    const ctx = document.getElementById('globalAnalysisChart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Meilleur total net après impôt',
                data: results.map(r => Math.max(r.totalNetAfterTaxPFU, r.totalNetAfterTaxProgressive)),
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }, {
                label: 'Total droits à la retraite',
                data: results.map(r => r.totalRetirement),
                borderColor: 'rgb(255, 99, 132)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Montant en euros'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Rémunération TNS brute'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        title: function(tooltipItems) {
                            return 'Salaire brut: ' + tooltipItems[0].label;
                        },
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(context.parsed.y);
                            }
                            return label;
                        },
                        afterBody: function(tooltipItems) {
                            const dataIndex = tooltipItems[0].dataIndex;
                            const data = results[dataIndex];
                            const bestOption = data.totalNetAfterTaxPFU > data.totalNetAfterTaxProgressive ? 'PFU' : 'Barème Progressif';
                            return [
                                '',
                                'Meilleure option: ' + bestOption,
                                'Total net après impôt (PFU): ' + new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(data.totalNetAfterTaxPFU),
                                'Total net après impôt (Progressif): ' + new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(data.totalNetAfterTaxProgressive),
                                'Montant alloué au salaire: ' + new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(data.salary),
                                'Montant alloué aux dividendes: ' + new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(data.dividends),
                                'Retraite base: ' + new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(data.baseRetirementYearlyAmount),
                                'Retraite complémentaire: ' + new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(data.complementaryRetirementAmount)
                            ];
                        }
                    }
                }
            }
        }
    });

    const bestOption = results.reduce((prev, current) => 
        (Math.max(prev.totalNetAfterTaxPFU, prev.totalNetAfterTaxProgressive) > Math.max(current.totalNetAfterTaxPFU, current.totalNetAfterTaxProgressive)) ? prev : current
    );

    $('#bestOption-salary').text(bestOption.salary.toLocaleString('fr-FR') + ' €/an');
    $('#bestOption-dividends').text(bestOption.dividends.toLocaleString('fr-FR') + ' €/an');
    $('#bestOption-fiscal').text(bestOption.totalNetAfterTaxPFU > bestOption.totalNetAfterTaxProgressive ? 'PFU' : 'Barème Progressif');
    $('#bestOption-totalNet').text(Math.round(Math.max(bestOption.totalNetAfterTaxPFU, bestOption.totalNetAfterTaxProgressive)).toLocaleString('fr-FR') + ' €/an');
    $('#bestOption-totalRetirement').text(Math.round(bestOption.totalRetirement).toLocaleString('fr-FR') + ' €/an');

    $('#result').show();
    $('#loading').hide();
}