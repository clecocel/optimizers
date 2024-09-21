let chart;

$(document).ready(function() {
    $('#advancedForm').on('submit', function(e) {
        e.preventDefault();
        const totalCost = parseInt($('#totalCostInput').val().replace(/[^0-9]/g, ''));
        $('#loading').show();
        $('#result').hide();
        $('#error').hide();
        analyzeOptimization(totalCost);
    });
});

function analyzeOptimization(totalCost) {
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
                "salarié . rémunération . net . payé après impôt",
                "impôt . revenu imposable",
                "protection sociale . retraite . base",
                "protection sociale . retraite . complémentaire"
            ],
            "situation": {
                "dirigeant . rémunération . totale": salary,
                "entreprise . catégorie juridique": "'SAS'"
            }
        };

        $.ajax({
            url: apiUrl,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(salaryData)
        }).done(function(salaryResponse) {
            const netSalary = salaryResponse.evaluate[0].nodeValue * 12; // Convert monthly to yearly
            const taxableIncome = salaryResponse.evaluate[1].nodeValue * 12; // Convert monthly to yearly
            const baseRetirementMonthlyAmount = salaryResponse.evaluate[2].nodeValue;
            const complementaryRetirementAmount = salaryResponse.evaluate[3].nodeValue * 4.3 * 12; // Convert to yearly amount for 43 years

            const corporateTax = calculateCorporateTax(dividends);
            const grossDividends = dividends - corporateTax;
            const netDividendsPFU = calculateNetDividendsPFU(grossDividends);
            const totalNetAfterTaxPFU = netSalary + netDividendsPFU;

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
                const totalNetAfterTaxProgressive = netSalary + netDividendsProgressive;

                results.push({
                    salary: salary,
                    dividends: dividends,
                    netSalary: netSalary,
                    netDividendsPFU: netDividendsPFU,
                    netDividendsProgressive: netDividendsProgressive,
                    totalNetAfterTaxPFU: totalNetAfterTaxPFU,
                    totalNetAfterTaxProgressive: totalNetAfterTaxProgressive,
                    baseRetirementYearlyAmount: baseRetirementMonthlyAmount * 12,
                    complementaryRetirementAmount: complementaryRetirementAmount
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
    console.log('Results:', results);

    const labels = results.map(r => r.salary.toLocaleString('fr-FR') + ' €');

    // Destroy existing chart if it exists
    if (chart) chart.destroy();

    // Create the after-tax chart
    const ctxAfterTax = document.getElementById('optimizationChartAfterTax').getContext('2d');
    chart = new Chart(ctxAfterTax, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Salaire net après impôt',
                data: results.map(r => r.netSalary),
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }, {
                label: 'Dividendes nets après impôt (PFU)',
                data: results.map(r => r.netDividendsPFU),
                borderColor: 'rgb(255, 99, 132)',
                tension: 0.1
            }, {
                label: 'Dividendes nets après impôt (Progressif)',
                data: results.map(r => r.netDividendsProgressive),
                borderColor: 'rgb(255, 159, 64)',
                tension: 0.1
            }, {
                label: 'Total net après impôt (PFU)',
                data: results.map(r => r.totalNetAfterTaxPFU),
                borderColor: 'rgb(54, 162, 235)',
                tension: 0.1
            }, {
                label: 'Total net après impôt (Progressif)',
                data: results.map(r => r.totalNetAfterTaxProgressive),
                borderColor: 'rgb(153, 102, 255)',
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
                        text: 'Montant alloué salaire'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        title: function(tooltipItems) {
                            return 'Montant alloué salaire : ' + tooltipItems[0].label;
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
                            const salary = results[dataIndex].salary;
                            const dividends = results[dataIndex].dividends;
                            const corporateTax = calculateCorporateTax(dividends);
                            const grossDividends = dividends - corporateTax;
                            return [
                                '',
                                'Montant alloué au salaire: ' + new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(salary),
                                'Montant alloué aux dividendes: ' + new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(dividends),
                                'Impôt sur les sociétés: ' + new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(corporateTax),
                                'Dividendes bruts (après IS): ' + new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(grossDividends)
                            ];
                        }
                    }
                }
            }
        }
    });

    chart.update();

    const bestOptionPFU = results.reduce((prev, current) => 
        (prev.totalNetAfterTaxPFU > current.totalNetAfterTaxPFU) ? prev : current
    );

    const bestOptionProgressive = results.reduce((prev, current) => 
        (prev.totalNetAfterTaxProgressive > current.totalNetAfterTaxProgressive) ? prev : current
    );

    // Update PFU values
    $('#pfu-salary').text(bestOptionPFU.salary.toLocaleString('fr-FR') + ' €');
    $('#pfu-dividends').text(bestOptionPFU.dividends.toLocaleString('fr-FR') + ' €');
    $('#pfu-net-salary').text(Math.round(bestOptionPFU.netSalary).toLocaleString('fr-FR') + ' €');
    $('#pfu-net-dividends').text(Math.round(bestOptionPFU.netDividendsPFU).toLocaleString('fr-FR') + ' €');
    $('#pfu-total-net').text(Math.round(bestOptionPFU.totalNetAfterTaxPFU).toLocaleString('fr-FR') + ' €');
    $('#pfu-base-retirement').text(Math.round(bestOptionPFU.baseRetirementYearlyAmount).toLocaleString('fr-FR') + ' €/an');
    $('#pfu-complementary-retirement').text(Math.round(bestOptionPFU.complementaryRetirementAmount).toLocaleString('fr-FR') + ' €/an');

    // Update Progressive values
    $('#progressive-salary').text(bestOptionProgressive.salary.toLocaleString('fr-FR') + ' €');
    $('#progressive-dividends').text(bestOptionProgressive.dividends.toLocaleString('fr-FR') + ' €');
    $('#progressive-net-salary').text(Math.round(bestOptionProgressive.netSalary).toLocaleString('fr-FR') + ' €');
    $('#progressive-net-dividends').text(Math.round(bestOptionProgressive.netDividendsProgressive).toLocaleString('fr-FR') + ' €');
    $('#progressive-total-net').text(Math.round(bestOptionProgressive.totalNetAfterTaxProgressive).toLocaleString('fr-FR') + ' €');
    $('#progressive-base-retirement').text(Math.round(bestOptionProgressive.baseRetirementYearlyAmount).toLocaleString('fr-FR') + ' €/an');
    $('#progressive-complementary-retirement').text(Math.round(bestOptionProgressive.complementaryRetirementAmount).toLocaleString('fr-FR') + ' €/an');

    // Update best fiscal option
    $('#best-fiscal-option').text(bestOptionPFU.totalNetAfterTaxPFU > bestOptionProgressive.totalNetAfterTaxProgressive ? 'PFU' : 'Barème Progressif');

    $('#result').show();
    $('#loading').hide();
}