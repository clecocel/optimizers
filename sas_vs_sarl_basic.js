$(document).ready(function() {
    $('#salaryInput').on('input', function() {
        let value = $(this).val().replace(/[^0-9]/g, '');
        if (value) {
            value = parseInt(value, 10);
            $(this).val(value.toLocaleString('fr-FR') + ' €');
        }
    });

    $('#salaryForm').on('submit', function(e) {
        e.preventDefault();
        submitSalary();
    });

    // Added event listener for Enter key press
    $('#salaryInput').on('keypress', function(e) {
        if (e.which === 13) { // Enter key code
            e.preventDefault();
            submitSalary();
        }
    });
});

function calculateSasData(yearlySalary, apiUrl) {
    const monthlySalary = Math.round(yearlySalary / 12);

    const sasData = {
        "expressions": [
            "dirigeant . rémunération . totale",
            "salarié . rémunération . net . à payer avant impôt",
            "salarié . rémunération . net . payé après impôt"
        ],
        "situation": {
            "salarié . contrat . salaire brut": monthlySalary,
            "entreprise . catégorie juridique": "'SAS'"
        }
    };

    return $.ajax({
        url: apiUrl,
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(sasData)
    });
}

function calculateSarlData(yearlyTotalCost, apiUrl) {
    const sarlComparisonData = {
        "expressions": [
            "dirigeant . rémunération . net",
            "dirigeant . rémunération . net . après impôt"
        ],
        "situation": {
            "entreprise . imposition": "'IS'",
            "entreprise . associés": "'unique'",
            "entreprise . catégorie juridique": "'SARL'",
            "dirigeant . rémunération . totale": Math.round(yearlyTotalCost)
        }
    };

    return $.ajax({
        url: apiUrl,
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(sarlComparisonData)
    });
}

function submitSalary() {
    const yearlySalary = parseInt($('#salaryInput').val().replace(/[^0-9]/g, ''));
    const apiUrl = 'https://mon-entreprise.urssaf.fr/api/v1/evaluate';

    calculateSasData(yearlySalary, apiUrl).done(function(sasResponse) {
        const yearlyTotalCost = sasResponse.evaluate[0].nodeValue;
        const monthlyNetSAS = sasResponse.evaluate[1].nodeValue;
        const yearlyNetSAS = monthlyNetSAS * 12;
        const monthlyNetAfterTaxSAS = sasResponse.evaluate[2].nodeValue;
        const yearlyNetAfterTaxSAS = monthlyNetAfterTaxSAS * 12;

        calculateSarlData(yearlyTotalCost, apiUrl).done(function(sarlResponse) {
            const yearlyNetSarl = sarlResponse.evaluate[0].nodeValue;
            const yearlyNetAfterTaxSarl = sarlResponse.evaluate[1].nodeValue;

            const results = {
                yearlyTotalCost,
                yearlyNetSAS,
                yearlyNetAfterTaxSAS,
                yearlyNetSarl,
                yearlyNetAfterTaxSarl,
                gainSarl: yearlyNetAfterTaxSarl - yearlyNetAfterTaxSAS
            };

            // Insert results into the pre-determined areas
            $('#totalCostSAS').text(results.yearlyTotalCost.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }));
            $('#netSalarySAS').text(results.yearlyNetSAS.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }));
            $('#netAfterTaxSAS').text(results.yearlyNetAfterTaxSAS.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }));
            $('#totalCostSARL').text(results.yearlyTotalCost.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }));
            $('#netSalarySARL').text(results.yearlyNetSarl.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }));
            $('#netAfterTaxSARL').text(results.yearlyNetAfterTaxSarl.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }));
            $('#gainSARL').text(results.gainSarl.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }));

            $('#result').show();
        }).fail(function(xhr, status, error) {
            console.error('Error in SARL comparison:', error);
            $('#result').append('<div class="alert alert-danger">Une erreur s\'est produite lors du calcul de la comparaison SARL.</div>');
        });
    }).fail(function(xhr, status, error) {
        console.error('Error:', error);
        $('#result').html('<div class="alert alert-danger">Une erreur s\'est produite lors du calcul des coûts.</div>').show();
    });
}