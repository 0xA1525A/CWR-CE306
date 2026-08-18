const $ = (e) => document.getElementById(e);

$("cci-convert").addEventListener("click", () => {
    const AVAILABLE_CURRENCIES = ["thb", "usd", "eur"];

    let fromAmount = $("ccf-from").value;
    let fromCurrency = $("ccc-from").value;
    let toCurrency = $("ccc-to").value;
    let parsedFromAmount = Number.parseInt(fromAmount);

    if (Number.isNaN(parsedFromAmount)
        || !AVAILABLE_CURRENCIES.includes(fromCurrency)
        || !AVAILABLE_CURRENCIES.includes(toCurrency)
    ) { return; }

    let result = convertCurrency(parsedFromAmount, fromCurrency, toCurrency);

    $("ccf-to").value = result;
    let toAmount = result;

    saveToLocalStorage(fromAmount, fromCurrency, toAmount, toCurrency);
    updateHistory();
});

$("hi-reset").addEventListener("click", () => {
    clearHistory();
    updateHistory();

    $("history-container").innerText = null;
});

const clearHistory = () => { localStorage.clear() };

const saveToLocalStorage = (fromAmount, fromCurrency, toAmount, toCurrency) => {
    let h = localStorage.getItem("cc-history");
    let content = [];
    if (h && !["", "null", "[object Object]"].includes(h)) {
        try {
            content = JSON.parse(h);
        }
        catch (e) {
            content = [];
        }
    }

    content.push({
        fromAmount: fromAmount,
        fromCurrency: fromCurrency,
        toAmount: toAmount,
        toCurrency: toCurrency
    });

    localStorage.setItem("cc-history", JSON.stringify(content));
}

const updateHistory = () => {
    let h = localStorage.getItem("cc-history");

    let history = [];
    if (h && !["", "null", "[object Object]"].includes(h)) {
        try {
            history = JSON.parse(h);
        }
        catch (e) {
            history = [];
        }
    }

    if (history.length === 0) { return; }

    const container = $("history-container");
    if (container) {
        container.innerHTML = "";
        for (let i = 0; i < history.length; i++) {
            let fromAmount = history[i].fromAmount;
            let fromCurrency = history[i].fromCurrency;
            let toAmount = history[i].toAmount;
            let toCurrency = history[i].toCurrency;

            container.innerHTML += constructHistoryCard(fromAmount, fromCurrency, toAmount, toCurrency);
        }
    }
}

const constructHistoryCard = (fromAmount, fromCurrency, toAmount, toCurrency) => `
<div class="conversion-history">
    <div class="ch-unit-wrapper">
        <span class="value">${fromAmount}</span>
        <span class="currency">${fromCurrency}</span>
    </div>
    <span class="arrow">&gt;</span>
    <div class="ch-unit-wrapper">
        <span class="value">${toAmount}</span>
        <span class="currency">${toCurrency}</span>
    </div>
</div>`;

$("cci-reset").addEventListener("click", () => {
    $("ccf-from").value = "";
    $("ccf-to").value = "";
});

$("cci-swap").addEventListener("click", () => {
    let fromAmount = $("ccf-from").value;
    let toAmount = $("ccf-to").value;

    $("ccf-from").value = toAmount;
    $("ccf-to").value = fromAmount;
});

const convertCurrency = (fromAmount, fromCurrency, toCurrency) => {
    switch (fromCurrency) {
    case "thb":
        switch (toCurrency) {
        case "thb":
            return fromAmount;
            break;

        case "usd":
            return fromAmount * 0.03;
            break;

        case "eur":
            return fromAmount * 0.026;
            break;
        }
        break;

    case "usd":
        switch (toCurrency) {
        case "thb":
            return fromAmount * 33;
            break;

        case "usd":
            return fromAmount;
            break;

        case "eur":
            return fromAmount * 0.86;
            break;
        }
        break;

    case "eur":
        switch (toCurrency) {
        case "thb":
            return fromAmount * 38.28;
            break;

        case "usd":
            return fromAmount * 1.16;
            break;

        case "eur":
            return fromAmount;
            break;
        }
        break;
    }
};

(() => { updateHistory(); })();