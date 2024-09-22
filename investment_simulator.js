let chart;

$(document).ready(function() {
    $('#investmentForm').on('submit', function(e) {
        e.preventDefault();
        const yearlyAmount = parseInt($('#yearlyAmountInput').val().replace(/[^0-9]/g, ''));
        const yield = parseFloat($('#yieldInput').val()) / 100;
        const duration = parseInt($('#durationInput').val());
        calculateInvestment(yearlyAmount, yield, duration);
    });
});

function calculateInvestment(yearlyAmount, yield, duration) {
    const results = [];
    let totalSaved = 0;

    for (let year = 1; year <= duration; year++) {
        totalSaved = (totalSaved * (1 + yield) + yearlyAmount);
        results.push({
            year: year,
            totalSaved: totalSaved
        });
    }

    displayResults(results, yearlyAmount, yield, duration);
}

function displayResults(results, yearlyAmount, yield, duration) {
    const labels = results.map(r => `Année ${r.year}`);
    const data = results.map(r => r.totalSaved);

    // Destroy existing chart if it exists
    if (chart) chart.destroy();

    // Create the investment chart
    const ctx = document.getElementById('investmentChart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Montant total épargné',
                data: data,
                borderColor: 'rgb(75, 192, 192)',
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
                        text: 'Années'
                    }
                }
            }
        }
    });

    const finalAmount = results[results.length - 1].totalSaved;
    const totalInvested = yearlyAmount * duration;
    const totalInterest = finalAmount - totalInvested;
    const yearlyInterest = finalAmount * yield;

    $('#finalDuration').text(duration);
    $('#finalAmount').text(finalAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }));
    $('#totalInvested').text(totalInvested.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }));
    $('#totalInterest').text(totalInterest.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }));
    $('#yearlyInterest').text(yearlyInterest.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }));

    $('#result').show();
}