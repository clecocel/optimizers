$(document).ready(function() {
    $('#totalCostInput').on('input', function() {
        let value = $(this).val().replace(/[^0-9]/g, '');
        if (value) {
            value = parseInt(value, 10);
            $(this).val(value.toLocaleString('fr-FR') + ' €');
        }
    });

    // Initialize popovers
    var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'))
    var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl, {
            trigger: 'focus'
        })
    })

    // Close popover when clicking outside
    $(document).on('click', function (e) {
        $('[data-bs-toggle="popover"]').each(function () {
            if (!$(this).is(e.target) && $(this).has(e.target).length === 0 && $('.popover').has(e.target).length === 0) {
                $(this).popover('hide');
            }
        });
    });
});

function calculateCorporateTax(profit) {
    if (profit <= 42500) {
        return profit * 0.15;
    } else {
        return 42500 * 0.15 + (profit - 42500) * 0.25;
    }
}

function calculateNetDividendsPFU(grossDividends) {
    const socialCharges = grossDividends * 0.172; // 17.2% social charges
    const flatTax = grossDividends * 0.128; // 12.8% flat tax on gross amount
    return grossDividends - socialCharges - flatTax;
}