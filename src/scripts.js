/*!
	Copyright © 2025 Justin Ludwig. All rights reserved.
	Licensed under the Business Source License 1.1 (BSL).
	See LICENSE file in the project root for details.
	
	You may not copy, distribute, or use this code commercially
	without explicit permission from the author.
*/

//todo: responsive js once layout is in place


// ===============================
// utility functions
// ===============================

const toCamelCase = str => str.toLowerCase().replace(/[-_\s]+([a-z])/g, (_, letter) => letter.toUpperCase());

const toKebabCase = str => str.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());

const sanitizeInput = value => value.trim().replace(/[<>]/g, '').replace(/\s+/g, ' ');

//used to make sure equations end with 2 decimals
const round2 = n => Math.round(n * 100) / 100;

//gets template from template list, replacements handle {{dynamic stuff}} e.g. {name: name,...}
function renderTemplate(template, replacements = {}){
	let html = template;
	for(const key in replacements){
		html = html.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), replacements[key]);
	}
	
	return html.replace(/{{\s*[\w]+\s*}}/g, ''); //clean up any other mustaches
}

// ===============================
// constants & elements
// ===============================

const processingFeeFlat = 0.25;
const processingRate = 0.03;
const transactionRate = .065;

const shippingLabelInput = document.getElementById('shipping-label');
const expensesList = document.getElementById('expenses-list');
const laborList = document.getElementById('labor-list');

const templates = {
	expensesList: `<li>
			<label class="name">
				<span class="sr-only">Material or Expense Name</span>
				<input type="text" placeholder="Material or Expense" value="{{name}}">
			</label>
			<label class="quantifier"><span>Qty: </span><span><input type="number" class="expense-qty" step="0.01" min="0" placeholder="0.00" value="{{qty}}"></span></label>
			<label class="amount"><span>Cost: </span><span class="flex-wrap"><span class="input-unit">$</span><input type="number" class="expense-cost" step="0.01" min="0" placeholder="0.00" value="{{cost}}"></span></label>
			<span class="sub"><span>Subtotal: </span><span>$<output class="subtotal" role="status" aria-live="polite">0.00</output></span></span>
			<button type="button" class="line-item-remover" aria-label="Remove this line item">×</button>
		</li>`,
	laborList: `<li>
			<label class="name">
				<span class="sr-only">Labor Type Name</span>
				<input type="text" placeholder="Labor Type" value="{{name}}">
			</label>
			<label class="quantifier"><span>Hours: </span><span><input type="number" class="labor-hours" step="0.01" min="0" placeholder="0.00" value="{{hours}}"></span></label>
			<label class="amount"><span>Rate: </span><span class="flex-wrap"><span class="input-unit">$</span><input type="number" class="labor-rate" step="0.01" min="0" placeholder="0.00" value="{{rate}}"></span></label>
			<span class="sub"><span>Subtotal: </span><span>$<output class="subtotal" role="status" aria-live="polite">0.00</output></span></span>
			<button type="button" class="line-item-remover" aria-label="Remove this labor entry">×</button>
		</li>`,
	storageList: `<li class="storage-item" data-key="{{key}}">
			<div class="file-name">{{name}}</div>
			<div class="file-actions">
				<div class="btn-grp main-actions">
					<button type="button" class="load-btn" aria-label="Load saved setup {{name}}">Load</button>
					<button type="button" class="append-btn" aria-label="Append saved setup {{name}}">Append</button>
					<button type="button" class="delete-btn" aria-label="Delete saved setup {{name}}">Delete</button>
				</div>
				<div class="btn-grp confirm-actions hidden">
					<button type="button" class="confirm-delete-btn" aria-label="Confirm delete saved setup {{name}}">Confirm Delete</button>
					<button type="button" class="cancel-delete-btn" aria-label="Cancel delete saved setup {{name}}">Cancel</button>
				</div>
			</div>
		</li>`,
	storageFullWarning: `<div id="storage-full-warning" class="warning" role="alert">Storage is full, remove some items to make room.</div>`,
	storageNameWarning: `<p id="storage-name-warning" class="warning" role="alert">Please add a name to save.</p>`
};

// ===============================
// totals proxy
// ===============================

/*
	totals object reference: these are used to display ouputs on the page
	{
		expensesTotal
		laborTotal
		valueTotal
		
		listingFeeTotal
		processingFeeTotal
		transactionFeeTotal
		shippingLabelFeeTotal
		offsiteAdFeeTotal
		feesTotal
		
		incomeTaxTotal
		
		listingPrice
		
		taxTotal
		customerTotal
		
		qcReturn //for quick calculator
		laborHoursTotal //only for display, not calculation
	}
*/	

const valueTotalDependencies = ['expensesTotal', 'laborTotal']; //the dynamic line item lists
const updateValueTotal = () => totals.valueTotal = valueTotalDependencies.reduce((sum, k) => sum + (totals[k] || 0), 0);

const feeKeys = Array.from(document.querySelectorAll('.fee-total')).map(el => toCamelCase(el.id));
const updateFeeTotal = () => totals.feesTotal = feeKeys.reduce((sum, k) => sum + (totals[k] || 0), 0);

const totals = new Proxy({}, {
	get(_, key) {
		const id = toKebabCase(key);
		const el = document.getElementById(id);
		if (el) return parseFloat(el.textContent) || 0;
		return 0;
	},
	set(_, key, value) {
		const id = toKebabCase(key);
		const el = document.getElementById(id);
		if (el) el.textContent = Number(value).toFixed(2);

		//automatically recalc valueTotal if needed
		if (valueTotalDependencies.includes(key)) updateValueTotal();
		
		//automatically recalc feesTotal if any individual fee changes
		if (feeKeys.includes(key)) updateFeeTotal();
		
		return true;
	}
});
totals.listingFeeTotal = 0.20;

// ===============================
// value & fees updates
// ===============================

function updateTotals(){
	updateAllLineItemLists();
	getTotalLaborHours();
	calculateListingPrice();
}

function clearInputs(){
	expensesList.querySelectorAll('li').forEach(li => li.remove());
	laborList.querySelectorAll('li').forEach(li => li.remove());
	shippingLabelInput.value = '';
	
	document.getElementById('sales-tax').value = 7.52;
	document.getElementById('income-tax-rate').value = (30).toFixed(2);
	document.querySelector('input[name="offsiteAdFee"][value="0"]').checked = true;
	offsiteAdRate = parseFloat(document.querySelector('input[name="offsiteAdFee"]:checked')?.value) / 100;
	document.querySelector('input[name="incomeTax"][value="ignore"]').checked = true;
	incomeTaxHandler = 'ignore';
	document.getElementById('save-product-name').value = '';
	updateProductHeading('clear');
	toggleIncomeTaxHandler();
	updateTotals();
}

document.getElementById('clear-form-btn')?.addEventListener('click', clearInputs);

// ===============================
// number input handling
// ===============================

//just want true numbers in the inputs, no e, +, -
document.addEventListener('keydown', event => {
	if(event.target.matches('input[type="number"]') && (event.key === 'e' || event.key === 'E' || event.key === '+' || event.key === '-')){
		event.preventDefault();
	}
});

//force 2 decimal places in number inputs
document.addEventListener('blur', event => {
	if (!event.target.matches('input[type="number"]')) return;

	const raw = event.target.value.trim();

	// only format if input is not empty
	if (raw === '') return;

	const value = parseFloat(raw);
	if (!isNaN(value)) {
		event.target.value = value.toFixed(2);
	}
}, true);

// ===============================
// add list item
// ===============================

//this is used for the line item lists and the saved product setups list
function addItem(list, replacements = {}, placement = 'append'){
	const templateKey = toCamelCase(list.id);
	const wrapper = document.createElement('div');
	wrapper.innerHTML = renderTemplate(templates[templateKey], replacements);
	const newItem = wrapper.firstElementChild;
	
	placement === 'append' ? list.append(newItem) : list.prepend(newItem);
	
	//focus on the newly created line item
	const firstInput = newItem.querySelector('input');
	firstInput?.focus();
	
	//accessibility: update the aria-label of line-item-remover buttons so they easily know whats being removed
	const nameInput = newItem.querySelector('input[type="text"]');
	const removeButton = newItem.querySelector('.line-item-remover');
	if (nameInput && removeButton) {
		const updateLabel = () => {
			const val = sanitizeInput(nameInput.value) || 'blank';
			removeButton.setAttribute('aria-label', `Remove ${val} line item`);
		};
		nameInput.addEventListener('input', updateLabel);
		updateLabel();
		
		removeButton.addEventListener('click', () => {
			newItem.remove();
			updateTotals();
		});
	}
	
	return newItem;
}

//add line items buttons
document.getElementById('add-expense-btn')?.addEventListener('click', () => addItem(expensesList));
document.getElementById('add-labor-btn')?.addEventListener('click', () => addItem(laborList));

// ===============================
// line item functions
// ===============================

function updateLineItemListTotal(list, totalKey) {
	//line items consist of 2 number inputs each that get multiplied together to output a subtotal
	const items = Array.from(list.querySelectorAll('li'));
	const subtotals = items.map(li => {
		const inputs = Array.from(li.querySelectorAll('input[type="number"]'));
		const product = inputs.reduce((acc, input) => acc * (parseFloat(input.value) || 0), inputs.length ? 1 : 0);
		const subtotalDisplay = li.querySelector('.subtotal');
		if (subtotalDisplay) subtotalDisplay.textContent = product.toFixed(2);
		return product;
	});

	totals[totalKey] = subtotals.reduce((sum, n) => sum + n, 0);
}
function bindLineItemListTotal(list, totalKey) {
	list.addEventListener('input', event => {
		if (event.target.matches('input[type="number"]')) {
			updateLineItemListTotal(list, totalKey);
		}
	});
}
bindLineItemListTotal(expensesList, 'expensesTotal');
bindLineItemListTotal(laborList, 'laborTotal');

function updateAllLineItemLists(){
	updateLineItemListTotal(expensesList, 'expensesTotal');
	updateLineItemListTotal(laborList, 'laborTotal');
}

//extra handling to display total labor hours
function getTotalLaborHours() {
	const inputs = document.querySelectorAll('.labor-hours');
	const hours = Array.from(inputs).reduce((total, input) => {
		const value = round2(parseFloat(input.value)) || 0;
		return total + value;
	}, 0);
	totals.laborHoursTotal = hours;
}
laborList.addEventListener('input', event => {
	if (event.target.matches('.labor-hours')) {
		getTotalLaborHours();
	}
});

// ===============================
// shipping label
// ===============================

shippingLabelInput.addEventListener('input', () => {
	const shippingCost = parseFloat(shippingLabelInput.value) || 0;
	totals.shippingLabelFeeTotal = round2(shippingCost * 0.065);
});

// ===============================
// income tax handlers
// ===============================

const getIncomeTaxHandler = () => document.querySelector('input[name="incomeTax"]:checked')?.value || 'ignore';
let incomeTaxHandler = getIncomeTaxHandler();
document.querySelectorAll('input[name="incomeTax"]').forEach(radio => {
	radio.addEventListener('change', () => {
		incomeTaxHandler = getIncomeTaxHandler();
		toggleIncomeTaxHandler();
		calculateListingPrice();
	});
});

function toggleIncomeTaxHandler(){
	document.getElementById('set-aside-taxes').classList.toggle('hidden', incomeTaxHandler === 'ignore');
}

//used in calculateListingPrice() //todo: this might be handled better
function calculateIncomeTax(){
	const incomeTaxRate = parseFloat((parseFloat(document.getElementById('income-tax-rate').value) / 100).toFixed(4)) || 0;
	
	switch (incomeTaxHandler) {
		case "ignore":
			totals.incomeTaxTotal = 0;
			break;
		
		case "view":
			totals.incomeTaxTotal = totals.laborTotal * incomeTaxRate;
			break;
		
		case "factor":
			totals.incomeTaxTotal = (totals.laborTotal / (1 - incomeTaxRate)) - totals.laborTotal;
			break;
	}
		
	return incomeTaxRate;
}

// ===============================
// offsite ad fee handler
// ===============================

const getOffsiteAdRate = () => parseFloat(document.querySelector('input[name="offsiteAdFee"]:checked')?.value) / 100;
let offsiteAdRate = getOffsiteAdRate();
document.querySelectorAll('input[name="offsiteAdFee"]').forEach(radio => {
	radio.addEventListener('change', () => {
		offsiteAdRate = getOffsiteAdRate();
		calculateListingPrice();
	});
});

// ===============================
// listing price calculations
// ===============================

function calculateListingPrice(){
	const incomeTaxRate = calculateIncomeTax();
	if(totals.valueTotal <= 0){ //get the displays back to zero if inputs are empty
		totals.listingPrice = 0;
		totals.processingFeeTotal = 0;
		totals.transactionFeeTotal = 0;
		totals.taxTotal = 0;
		totals.customerTotal = 0;
		totals.offsiteAdFeeTotal = 0;
		return;
	}
	
	const totalFlatFees = totals.listingFeeTotal + processingFeeFlat;
	let net = incomeTaxHandler === 'factor' ? totals.valueTotal / (1 - (incomeTaxRate || 0)) : totals.valueTotal;
	const shippingLabel = parseFloat(shippingLabelInput.value) || 0;
	const salesTaxRate = parseFloat((parseFloat(document.getElementById('sales-tax').value) / 100).toFixed(4)) || 0; //formats from input 7.52 -> .0752
	
	const compoundRate = transactionRate + (processingRate * (1 + salesTaxRate)) + offsiteAdRate;
	const denominator = 1 - compoundRate;
	if (denominator <= 0) return;
	
	const listingPriceRaw = (net + (shippingLabel * compoundRate) + totalFlatFees) / denominator;
	const listingPrice = Math.ceil(listingPriceRaw * 100) / 100; //doing it this way to account for rounding
	totals.listingPrice = listingPrice;
	
	const subtotal = listingPrice + shippingLabel;
	const tax = round2(subtotal * salesTaxRate);
	totals.transactionFeeTotal = round2(listingPrice * transactionRate);
	totals.taxTotal = tax;
	totals.processingFeeTotal = round2((subtotal + tax) * processingRate) + processingFeeFlat;
	totals.offsiteAdFeeTotal = round2(subtotal * offsiteAdRate);
	totals.customerTotal = (subtotal + tax);
}

// ===============================
// quick calculator
// ===============================

function calculateReturn(){
	const qcListingPrice = parseFloat(document.getElementById('qc-listing-price').value) || 0;
	if (qcListingPrice === 0) return totals.qcReturn = 0; //don't want to show a negative return
	
	const qcTax = 1.0752; //just using the average sales tax since this is a simple estimation tool
	const qcProcessingFee = round2((qcListingPrice * qcTax) * processingRate) + processingFeeFlat;
	const qcTransactionFee = round2(qcListingPrice * transactionRate);
	const qcFees = round2(qcProcessingFee + qcTransactionFee + totals.listingFeeTotal);
	
	totals.qcReturn = qcListingPrice - qcFees;
}

// ===============================
// calculation type handler
// ===============================

document.addEventListener('input', event => {
	if (!event.target.matches('input[type="number"]')) return;
	
	if (event.target.closest('#listing-price-calculator')){
		calculateListingPrice();
	} else if(event.target.closest('#quick-calculator')){
		calculateReturn();
	}
});

// ===============================
// localStorage setup
// ===============================

const elpcPrefix = 'elpc_'; //prefix for localStorage items
const storageList = document.getElementById('storage-list');

function isQuotaExceededError(error){
	return (
		error instanceof DOMException &&
		// everything except firefox
		(error.code === 22 || error.name === "QuotaExceededError" ||
		// firefox
		error.code === 1014 || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
	);
}

function displayStorageError(){
	document.getElementById('storage').classList.add("storage-full");
	document.getElementById('storage-save-field').insertAdjacentHTML('afterend', templates.storageFullWarning);
}
function hideStorageError(){
	document.getElementById('storage').classList.remove("storage-full");
	document.querySelector('#storage-full-warning')?.remove();
}

function isStorageSupported(){
	try {
		if(!localStorage){
			return false;
		}
		const testKey = '__storage_test__';
		localStorage.setItem(testKey, testKey);
		localStorage.removeItem(testKey);
		hideStorageError();
		return true;
	} catch (error){
		const quotaFull = isQuotaExceededError(error) && localStorage.length > 0;
		if(quotaFull){
			displayStorageError();
		}
		return quotaFull;
	}
}

isStorageSupported() ? loadSavedSetups() : document.body.classList.add('no-storage');

// ===============================
// localStorage functions
// ===============================

function saveProductSetup(){
	const saveName = sanitizeInput(document.getElementById('save-product-name').value);
	//feature: you can use the same file name to update a file that's already saved
	document.querySelector('#storage-name-warning')?.remove();
	if(!saveName){
		document.getElementById('save-setup-btn').blur();
		document.getElementById('storage-save-field').insertAdjacentHTML('afterend', templates.storageNameWarning);
		return;
	}
	
	const keyName = elpcPrefix+toCamelCase(saveName);
	const setup = {
		name: saveName,
		expenses: {},
		labor: {},
		shipping: shippingLabelInput.value,
		tax: document.getElementById('sales-tax')?.value,
		adRate: document.querySelector('input[name="offsiteAdFee"]:checked')?.value,
		taxFactor: incomeTaxHandler,
		taxRate: document.getElementById('income-tax-rate')?.value,
		timeStamp: Date.now()
	};
	//each of the expenses - has name & qty & cost
	expensesList.querySelectorAll('li').forEach((li,i) => {
		setup.expenses[i] = {
			name: sanitizeInput(li.querySelector('input[type="text"]').value),
			qty: li.querySelector('.expense-qty').value,
			cost: li.querySelector('.expense-cost').value
		};
	});
	
	//each of the labors - has name & hours & rate
	laborList.querySelectorAll('li').forEach((li,i) => {
		setup.labor[i] = {
			name: sanitizeInput(li.querySelector('input[type="text"]').value),
			hours: li.querySelector('.labor-hours').value,
			rate: li.querySelector('.labor-rate').value
		};
	});
	
	try {
		localStorage.setItem(keyName, JSON.stringify(setup));
	} catch (error){
		displayStorageError();
		return false;
	}
	
	let listItem = document.querySelector('#storage-list [data-key="'+keyName+'"]');
	if(listItem){
		storageList.prepend(listItem); //want updated save files to go to the top of the list
	} else {
		listItem = addItem(storageList, {name: saveName, key: keyName}, 'prepend');
	}
	
	updateProductHeading('save', setup.name);
	
	listItem.classList.add("saved");
	setTimeout(() => listItem.classList.remove('saved'), 1000);
	
}

//creates the list of saved product setups
function loadSavedSetups(){
	Object.keys(localStorage)
		.filter(k => k.startsWith(elpcPrefix))
		.map(k => ({key:k, data:JSON.parse(localStorage.getItem(k))}))
		.sort((a,b) => b.data.timeStamp - a.data.timeStamp)
		.forEach(item => addItem(storageList, {name: item.data.name, key: item.key}));
}

function getSingleSetup(key){
	const storageItem = localStorage.getItem(key);
	return storageItem ? JSON.parse(storageItem) : null;
}

//used when loading or appending a saved setup
function loadManufacturingCosts(setup){
	Object.entries(setup.expenses).forEach(([key, obj]) => {
		addItem(expensesList, {name: obj.name, qty: obj.qty, cost: obj.cost});
	});
	
	Object.entries(setup.labor).forEach(([key, obj]) => {
		addItem(laborList, {name: obj.name, hours: obj.hours, rate: obj.rate});
	});
}

//used when loading a saved setup
function loadIndirectCosts(setup){
	shippingLabelInput.value = setup.shipping;
	document.getElementById('sales-tax').value = setup.tax;
	document.getElementById('income-tax-rate').value = setup.taxRate;
	
	document.querySelector('input[name="offsiteAdFee"][value="'+setup.adRate+'"]').checked = true;
	offsiteAdRate = parseFloat(document.querySelector('input[name="offsiteAdFee"]:checked').value) / 100;
	
	document.querySelector('input[name="incomeTax"][value="'+setup.taxFactor+'"]').checked = true;
	incomeTaxHandler = setup.taxFactor;
	toggleIncomeTaxHandler();
}

// ===============================
// localStorage event handlers
// ===============================

storageList.addEventListener('click', e => {
	const li = e.target.closest('.storage-item');
	if(!li) return;
	const key = li.dataset.key;
	const setup = getSingleSetup(key);
	
	if(e.target.classList.contains('load-btn')) {
		clearInputs();
		updateProductHeading('load', setup.name);
		document.getElementById('save-product-name').value = setup.name;
		loadIndirectCosts(setup);
		loadManufacturingCosts(setup);
		updateTotals();
		
		//todo: check about function for this
		document.body.classList.remove('overflow');
		document.getElementById('storage').classList.remove('open');
		document.getElementById('open-storage').focus();
		
		focusTopOfForm();
	}
	
	if(e.target.classList.contains('append-btn')) {
		loadManufacturingCosts(setup);
		updateTotals();
		focusTopOfForm();
	}
	
	if(e.target.classList.contains('delete-btn')) {
		li.querySelector('.main-actions').classList.add('hidden');
		li.querySelector('.confirm-actions').classList.remove('hidden');
	}
	
	if(e.target.classList.contains('confirm-delete-btn')) {
		updateProductHeading('delete', setup.name);
		localStorage.removeItem(key);
		li.remove();
	}
	
	if(e.target.classList.contains('cancel-delete-btn')) {
		li.querySelector('.main-actions').classList.remove('hidden');
		li.querySelector('.confirm-actions').classList.add('hidden');
	}
});

document.getElementById('save-setup-btn')?.addEventListener('click', saveProductSetup);

// ===============================
// display adjustments
// ===============================

function focusTopOfForm(focus = true) {
	const form = document.getElementById('listing-price-calculator');
	if(focus){
		form?.focus();
		document.querySelector('main').scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
}

/* rules for updateProductHeading()
	on load: replace current heading with save name
	on append: do nothing
	on delete: if this one is currently open, change heading to default, empty save name field; else do nothing
	on save: replace current heading with save name
	on clear: replace current heading with default
*/
function updateProductHeading(action, text = ''){
	const heading = document.getElementById('calculator-heading');
	const defaultValue = 'Your Product Information';
	text = text === '' ? defaultValue : text;
	
	switch (action) {
		case "load":
			heading.textContent = text;
			break;
		
		case "delete":
			if(heading.textContent == text){
				heading.textContent = defaultValue;
				//not the best place for this since it's a different thing than function claims, but the simplest way to implement this
				document.getElementById('save-product-name').value = '';
			}
			break;
		
		case "save":
			heading.textContent = text;
			break;
			
		case "clear":
			heading.textContent = defaultValue;
			break;
	}
}

// ===============================
// display interactions
// ===============================

//tool-tips
document.querySelectorAll('.tool-tip-toggle').forEach(btn => {
	btn.addEventListener('click', e => {
		const parent = e.target.closest('.tool-tip');
		if (parent) parent.classList.toggle('open');
	});
});

//more-info
document.querySelectorAll('.more-info-toggle').forEach(btn => {
	btn.addEventListener('click', e => {
		const parent = e.target.closest('.more-info');
		if (parent) parent.classList.toggle('open');
	});
});

//estimates
document.getElementById('estimates-toggle').addEventListener('click', e => {
	document.getElementById('estimates-toggle').classList.toggle('open');
	document.getElementById('estimates').classList.toggle('open');
});

//storage
document.getElementById('open-storage').addEventListener('click', e => {
	document.body.classList.add('overflow');
	document.getElementById('storage').classList.add('open');
	document.getElementById('save-product-name').focus();
});
document.getElementById('close-storage').addEventListener('click', e => {
	document.body.classList.remove('overflow');
	document.getElementById('storage').classList.remove('open');
	document.getElementById('open-storage').focus();
});

//quick-calculator

document.getElementById('open-qc').addEventListener('click', e => {
	document.body.classList.add('overflow');
	document.getElementById('quick-calculator').classList.add('open');
	document.getElementById('qc-listing-price').focus();
});
document.getElementById('close-qc').addEventListener('click', e => {
	document.body.classList.remove('overflow');
	document.getElementById('quick-calculator').classList.remove('open');
	document.getElementById('open-qc').focus();
});
