let comparisonChart = null; // Declare this variable at the top of your script, outside any function

$(document).ready(function() {
    $('#totalCostInput').on('input', function() {
        let value = $(this).val().replace(/[^0-9]/g, '');
        if (value) {
            value = parseInt(value, 10);
            $(this).val(value.toLocaleString('fr-FR') + ' €');
        }
    });

    $('#comparisonForm').on('submit', function(e) {
        e.preventDefault();
        const totalCost = parseInt($('#totalCostInput').val().replace(/[^0-9]/g, ''));
        $('#result').hide();
        $('#loading').show();
        $('#error').hide();
        compareStatuses(totalCost);
    });
});

function calculateSARL(apiUrl, totalCost) {
    const data = {
        "expressions": [
            "dirigeant . rémunération . net",
            "dirigeant . rémunération . net . après impôt",
            "protection sociale . retraite . base",
            "protection sociale . retraite . complémentaire . RCI"
        ],
        "situation": {
            "entreprise . imposition": "'IS'",
            "entreprise . associés": "'unique'",
            "entreprise . catégorie juridique": "'SARL'",
            "dirigeant . rémunération . totale": totalCost
        }
    };

    return $.ajax({
        url: apiUrl,
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(data)
    }).then(function(response) {
        const netSalary = response.evaluate[0].nodeValue;
        const netSalaryAfterTax = response.evaluate[1].nodeValue;
        const baseRetirementMonthlyAmount = response.evaluate[2].nodeValue;
        const complementaryRetirementAmount = response.evaluate[3].nodeValue * 43;
        return {
            salary: totalCost,
            netSalary: netSalary,
            netSalaryAfterTax: netSalaryAfterTax,
            baseRetirementYearlyAmount: baseRetirementMonthlyAmount * 12,
            complementaryRetirementAmount: complementaryRetirementAmount
        };
    });
}

function calculateSAS(apiUrl, totalCost) {
    const data = {
        "expressions": [
            "salarié . rémunération . net",
            "salarié . rémunération . net . payé après impôt",
            "protection sociale . retraite . base",
            "protection sociale . retraite . complémentaire"
        ],
        "situation": {
            "dirigeant . rémunération . totale": totalCost,
            "entreprise . catégorie juridique": "'SAS'"
        }
    };

    return $.ajax({
        url: apiUrl,
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(data)
    }).then(function(response) {
        const netSalary = response.evaluate[0].nodeValue * 12;
        const netSalaryAfterTax = response.evaluate[1].nodeValue * 12;
        const baseRetirementMonthlyAmount = response.evaluate[2].nodeValue;
        const complementaryRetirementAmount = response.evaluate[3].nodeValue * 4.3 * 12;
        return {
            salary: totalCost,
            netSalary: netSalary,
            netSalaryAfterTax: netSalaryAfterTax,
            baseRetirementYearlyAmount: baseRetirementMonthlyAmount * 12,
            complementaryRetirementAmount: complementaryRetirementAmount
        };
    });
}

function compareStatuses(totalCost) {
    const apiUrl = 'https://mon-entreprise.urssaf.fr/api/v1/evaluate';

    Promise.all([
        calculateSARL(apiUrl, totalCost),
        calculateSAS(apiUrl, totalCost)
    ]).then(([sarlResults, sasResults]) => {
        displayResults(sarlResults, sasResults, totalCost);
    }).catch((error) => {
        console.error('Error in calculations:', error);
        $('#loading').hide();
        $('#error').show().text('Une erreur est survenue lors de l\'analyse. Veuillez réessayer plus tard.');
    });
}

function displayResults(sarlResults, sasResults, totalCost) {
    // Destroy the existing chart if it exists
    if (comparisonChart && typeof comparisonChart.destroy === 'function') {
        comparisonChart.destroy();
    }

    const ctx = document.getElementById('comparisonChart').getContext('2d');
    comparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['SARL', 'SAS'],
            datasets: [
                {
                    label: 'Salaire net',
                    data: [sarlResults.netSalary, sasResults.netSalary],
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgb(75, 192, 192)',
                    borderWidth: 1
                },
                {
                    label: 'Salaire net après impôt',
                    data: [sarlResults.netSalaryAfterTax, sasResults.netSalaryAfterTax],
                    backgroundColor: 'rgba(153, 102, 255, 0.6)',
                    borderColor: 'rgb(153, 102, 255)',
                    borderWidth: 1
                },
                {
                    label: 'Retraite base',
                    data: [sarlResults.baseRetirementYearlyAmount, sasResults.baseRetirementYearlyAmount],
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                    borderColor: 'rgb(255, 99, 132)',
                    borderWidth: 1
                },
                {
                    label: 'Retraite complémentaire',
                    data: [sarlResults.complementaryRetirementAmount, sasResults.complementaryRetirementAmount],
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgb(54, 162, 235)',
                    borderWidth: 1
                }
            ]
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
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });

    $('#totalCostSARL').text(totalCost.toLocaleString('fr-FR') + ' €/an');
    $('#totalCostSAS').text(totalCost.toLocaleString('fr-FR') + ' €/an');
    $('#netSalarySARL').text(Math.round(sarlResults.netSalary).toLocaleString('fr-FR') + ' €/an');
    $('#netSalarySAS').text(Math.round(sasResults.netSalary).toLocaleString('fr-FR') + ' €/an');
    $('#netAfterTaxSARL').text(Math.round(sarlResults.netSalaryAfterTax).toLocaleString('fr-FR') + ' €/an');
    $('#netAfterTaxSAS').text(Math.round(sasResults.netSalaryAfterTax).toLocaleString('fr-FR') + ' €/an');
    $('#baseRetirementSARL').text(Math.round(sarlResults.baseRetirementYearlyAmount).toLocaleString('fr-FR') + ' €/an');
    $('#baseRetirementSAS').text(Math.round(sasResults.baseRetirementYearlyAmount).toLocaleString('fr-FR') + ' €/an');
    $('#complementaryRetirementSARL').text(Math.round(sarlResults.complementaryRetirementAmount).toLocaleString('fr-FR') + ' €/an');
    $('#complementaryRetirementSAS').text(Math.round(sasResults.complementaryRetirementAmount).toLocaleString('fr-FR') + ' €/an');
    $('#totalRetirementSARL').text(Math.round(sarlResults.baseRetirementYearlyAmount + sarlResults.complementaryRetirementAmount).toLocaleString('fr-FR') + ' €/an');
    $('#totalRetirementSAS').text(Math.round(sasResults.baseRetirementYearlyAmount + sasResults.complementaryRetirementAmount).toLocaleString('fr-FR') + ' €/an');

    $('#result').show();
    $('#loading').hide();
}