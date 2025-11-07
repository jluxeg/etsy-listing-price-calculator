/*!
	Copyright © 2025 Justin Ludwig. All rights reserved.
	Licensed under the Business Source License 1.1 (BSL).
	See LICENSE file in the project root for details.
	
	You may not copy, distribute, or use this code commercially
	without explicit permission from the author.
*/


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
			<label class="quantifier">
				<span>Qty: </span>
				<span>
					<input type="number" class="expense-qty" step="0.01" min="0" placeholder="0.00" value="{{qty}}">
				</span>
			</label>
			<label class="amount">
				<span>Cost: </span>
				<span class="flex-wrap">
					<span class="input-unit">$</span>
					<input type="number" class="expense-cost" step="0.01" min="0" placeholder="0.00" value="{{cost}}">
				</span>
			</label>
			<span class="sub">
				<span>Subtotal: </span>
				<span>$<output class="subtotal" role="status" aria-live="polite">0.00</output></span>
			</span>
			<button type="button" class="line-item-remover btn-warning" aria-label="Remove this line item">×</button>
		</li>`,
	laborList: `<li>
			<label class="name">
				<span class="sr-only">Labor Type Name</span>
				<input type="text" placeholder="Labor Type" value="{{name}}">
			</label>
			<label class="quantifier">
				<span>Hours: </span>
				<span>
					<input type="number" class="labor-hours" step="0.01" min="0" placeholder="0.00" value="{{hours}}">
				</span>
			</label>
			<label class="amount">
				<span>Rate: </span>
				<span class="flex-wrap">
					<span class="input-unit">$</span>
					<input type="number" class="labor-rate" step="0.01" min="0" placeholder="0.00" value="{{rate}}">
				</span>
			</label>
			<span class="sub">
				<span>Subtotal: </span>
				<span>$<output class="subtotal" role="status" aria-live="polite">0.00</output></span>
			</span>
			<button type="button" class="line-item-remover btn-warning" aria-label="Remove this labor entry">×</button>
		</li>`,
	storageList: `<li class="storage-item" data-key="{{key}}">
			<div class="file-name">{{name}}</div>
			<div class="file-actions">
				<div class="btn-grp main-actions">
					<button type="button" class="load-btn btn-primary" aria-label="Load saved setup {{name}}">Load</button>
					<button type="button" class="append-btn btn-secondary" aria-label="Append saved setup {{name}}">Append</button>
					<button type="button" class="delete-btn btn-warning" aria-label="Delete saved setup {{name}}">Delete</button>
				</div>
				<div class="btn-grp confirm-actions hidden">
					<button type="button" class="confirm-delete-btn btn-warning" aria-label="Confirm delete saved setup {{name}}">Confirm Delete</button>
					<button type="button" class="cancel-delete-btn btn-secondary" aria-label="Cancel delete saved setup {{name}}">Cancel</button>
				</div>
			</div>
		</li>`	
};
const notices = {
	storageFullWarning: `<p id="storage-full-warning" class="warning" role="alert">Storage is full, remove some items to make room.</p>`,
	storageNameWarning: `<p id="storage-name-warning" class="warning" role="alert">Please add a name to save.</p>`,
	productSetupSaved: `<p id="product-setup-saved" class="success" role="alert">Product setup saved!</p>`,
	productSetupUpdated: `<p id="product-setup-saved" class="success" role="alert">Product setup updated!</p>`
};

// ===============================
// totals proxy
// ===============================

/*
	totals object reference: these are used to display ouputs on the page
	{
		expensesTotal
		laborTotal //the rates
		laborHoursTotal //only for display, not calculation
		valueTotal
		
		listingFeeTotal // this should never change
		processingFeeTotal
		transactionFeeTotal
		shippingLabelFeeTotal
		offsiteAdFeeTotal
		feesTotal
		
		listingPrice
		returnTotal
		
		taxTotal
		customerTotal
		
		incomeTaxTotal
		
		qcReturn //for quick calculator
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
	
	setOffsiteAdHandler('ignore');
	document.querySelector('input[name="offsiteAdFee"][value="15"]').checked = true;
	
	setIncomeTaxHandler('ignore');
	document.getElementById('income-tax-rate').value = (30).toFixed(2);
	
	updateProductHeading('clear');
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
			const val = sanitizeInput(nameInput.value) || 'unnamed';
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

//buttons to add line items
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
// offsite ad fee handlers
// ===============================

let offsiteAdHandler = 'ignore';

function setOffsiteAdHandler(value) {
	offsiteAdHandler = value;
	document.querySelector(`input[name="offsiteAd"][value="${value}"]`).checked = true;
	toggleOffsiteAdDisplay();
}

//update the offsite ad fee handler when the radios are changed
document.querySelectorAll('input[name="offsiteAd"]').forEach(radio => {
	radio.addEventListener('change', () => {
		setOffsiteAdHandler(radio.value);
		calculateListingPrice();
	});
});

//toggle display in totals
function toggleOffsiteAdDisplay(){
	document.getElementById('offsite-ad-fee-total-li').classList.toggle('hidden', offsiteAdHandler === 'ignore');
}

//get the selected offsite ad rate to calculate with
function getOffsiteAdRate(){
	if(offsiteAdHandler === 'ignore'){
		return 0;
	} else {
		return parseFloat(document.querySelector('input[name="offsiteAdFee"]:checked')?.value) / 100;
	}
}

//update the offsite ad rate when the radios are changed
document.querySelectorAll('input[name="offsiteAdFee"]').forEach(radio => {
	radio.addEventListener('change', () => {
		calculateListingPrice();
	});
});

// ===============================
// income tax handlers
// ===============================

let incomeTaxHandler = 'ignore';

function setIncomeTaxHandler(value) {
	incomeTaxHandler = value;
	document.querySelector(`input[name="incomeTax"][value="${value}"]`).checked = true;
	toggleIncomeTaxDisplay();
}

//update the income tax handler when the radios are changed
document.querySelectorAll('input[name="incomeTax"]').forEach(radio => {
	radio.addEventListener('change', () => {
		setIncomeTaxHandler(radio.value);
		calculateListingPrice();
	});
});

//toggle display in totals
function toggleIncomeTaxDisplay(){
	document.getElementById('set-aside-taxes').classList.toggle('hidden', incomeTaxHandler === 'ignore');
}

//used in calculateListingPrice()
function calculateIncomeTax(){
	const incomeTaxRate = parseFloat((parseFloat(document.getElementById('income-tax-rate').value) / 100).toFixed(4)) || 0;
	
	//this preps the total for income tax to set aside, value not specifically used in the listing price calculating so doing it here
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
	
	//returns the entered rate
	return incomeTaxRate;
}

// ===============================
// listing price calculations
// ===============================

function calculateListingPrice(){
	if(totals.valueTotal <= 0){ //get the displays back to zero if inputs are empty
		totals.listingPrice = 0;
		totals.processingFeeTotal = 0;
		totals.transactionFeeTotal = 0;
		totals.taxTotal = 0;
		totals.customerTotal = 0;
		totals.offsiteAdFeeTotal = 0;
		totals.shippingLabelFeeTotal = 0;
		totals.returnTotal = 0;
		return;
	}
	
	const incomeTaxRate = calculateIncomeTax();
	const offsiteAdRate = getOffsiteAdRate();
	const totalFlatFees = totals.listingFeeTotal + processingFeeFlat;
	
	let net;
	if(incomeTaxHandler === 'factor'){
		net = (totals.laborTotal / (1 - (incomeTaxRate || 0))) + totals.expensesTotal;
	} else {
		net = totals.valueTotal;
	}
	const shippingLabel = parseFloat(shippingLabelInput.value) || 0;
	const salesTaxRate = parseFloat((parseFloat(document.getElementById('sales-tax').value) / 100).toFixed(4)) || 0; //formats from input 7.52 -> .0752
	
	let compoundRate;
	if(offsiteAdHandler === 'factor'){
		compoundRate = transactionRate + (processingRate * (1 + salesTaxRate)) + offsiteAdRate;
	} else {
		compoundRate = transactionRate + (processingRate * (1 + salesTaxRate));
	}
	
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
	
	totals.returnTotal = listingPrice - (totals.feesTotal + totals.incomeTaxTotal);
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

document.getElementById('open-qc').addEventListener('click', e => {
	openModal('quick-calculator', 'qc-listing-price');
});

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
	document.body.classList.add("storage-full");
	if(!document.getElementById('storage-full-warning')){
		document.getElementById('header-notices').insertAdjacentHTML('beforeend', notices.storageFullWarning);
	}
}
function hideStorageError(){
	document.body.classList.remove("storage-full");
	document.querySelector('#storage-full-warning')?.remove();
}

function isStorageSupported(){
	try {
		if (typeof localStorage === 'undefined') return false;
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

function noStorage(){
	document.body.classList.add('no-storage');
	document.getElementById('save-product-name').outerHTML = '<h2 id="save-product-name">Your Product Information</h2>';
}

isStorageSupported() ? loadSavedSetups() : noStorage();

// ===============================
// localStorage functions
// ===============================

function saveProductSetup(){
	const saveName = sanitizeInput(document.getElementById('save-product-name').textContent);
	//feature: you can use the same file name to update a file that's already saved
	document.querySelector('#storage-name-warning')?.remove();
	if(!saveName){
		document.getElementById('save-setup-btn').blur();
		document.getElementById('header-notices').insertAdjacentHTML('beforeend', notices.storageNameWarning);
		return;
	}
	
	const keyName = elpcPrefix+toCamelCase(saveName);
	const setup = {
		name: saveName,
		expenses: {},
		labor: {},
		shipping: shippingLabelInput.value,
		tax: document.getElementById('sales-tax')?.value,
		adFactor: offsiteAdHandler,
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
		hideStorageError();
	} catch (error){
		displayStorageError();
		return false;
	}
	
	let listItem = document.querySelector('#storage-list [data-key="'+keyName+'"]');
	if(listItem){
		storageList.prepend(listItem); //want updated save files to go to the top of the list
		listItem.querySelector('.file-name').textContent = saveName; //file names are not case sensative, but if they chage the case show it
		document.getElementById('header-notices').insertAdjacentHTML('beforeend', notices.productSetupUpdated);
	} else {
		listItem = addItem(storageList, {name: saveName, key: keyName}, 'prepend');
		document.getElementById('header-notices').insertAdjacentHTML('beforeend', notices.productSetupSaved);
	}
	
	document.getElementById('save-setup-btn').blur();
	
	updateProductHeading('save', setup.name); //keep this so that it changes the displayed name to the cleaned version
	
	setTimeout(() => document.getElementById('product-setup-saved').remove(), 1000);
	
	//keeping this around for now incase i move it back out of the modal again for larger screens
	listItem.classList.add("saved");
	setTimeout(() => listItem.classList.remove('saved'), 1000);
	
}

//creates the list of saved product setups
function loadSavedSetups(){
	const items = Object.keys(localStorage)
		.filter(k => k.startsWith(elpcPrefix))
		.map(k => ({key:k, data:JSON.parse(localStorage.getItem(k))}))
		.sort((a,b) => b.data.timeStamp - a.data.timeStamp);
	if (items.length > 0) {
		document.querySelector('#nothing-saved-notice').remove();
	}
	items.forEach(item => addItem(storageList, {name: item.data.name, key: item.key}));
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
	totals.shippingLabelFeeTotal = round2(shippingLabelInput.value * 0.065);
	document.getElementById('sales-tax').value = setup.tax;
	
	document.querySelector('input[name="offsiteAdFee"][value="'+setup.adRate+'"]').checked = true;
	setOffsiteAdHandler(setup.adFactor);
	
	document.getElementById('income-tax-rate').value = setup.taxRate;
	setIncomeTaxHandler(setup.taxFactor);
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
		document.getElementById('save-product-name').textContent = setup.name;
		loadIndirectCosts(setup);
		loadManufacturingCosts(setup);
		updateTotals();
		
		closeModal();
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
		localStorage.removeItem(key);
		li.remove();
	}
	
	if(e.target.classList.contains('cancel-delete-btn')) {
		li.querySelector('.main-actions').classList.remove('hidden');
		li.querySelector('.confirm-actions').classList.add('hidden');
	}
});

document.getElementById('save-setup-btn')?.addEventListener('click', saveProductSetup);
document.getElementById('open-storage').addEventListener('click', e => {
	openModal('storage', 'storage-list');
});

// ===============================
// modal handlers
// ===============================

function openModal(modal, focusEl){
	document.body.classList.add('overflow');
	document.getElementById(modal).classList.add('open');
	document.getElementById(focusEl).focus();
}

function closeModal(){
	const modal = document.querySelector('.modal.open');
	const modalCloseBtn = modal.querySelector('.close-modal');
	const focusEl = modalCloseBtn.dataset.focusel;
	
	document.body.classList.remove('overflow');
	modal.classList.remove('open');
	document.getElementById(focusEl).focus();
}

document.querySelectorAll('.close-modal').forEach(btn => {
	btn.addEventListener('click', e => {
		closeModal();
	});
});

document.body.addEventListener('click', e => {
	if(e.target.classList.contains('overflow')){
		closeModal();
	}
});

document.addEventListener('keydown', e => {
	if (e.key === 'Escape') {
		const modal = document.querySelector('.modal.open');
		if(modal){
			closeModal();
		}
	}
});

// ===============================
// display adjustments
// ===============================

//some scrolling behavior help
function scrollToElementWithOffset(el, offset = 100, behavior = 'smooth') {
	const rect = el.getBoundingClientRect();
	const absoluteTop = rect.top + window.scrollY;
	const targetY = absoluteTop - offset;
	
	window.scrollTo({
		top: targetY,
		behavior: behavior
	});
}

function focusTopOfForm(focus = true) {
	const form = document.getElementById('listing-price-calculator');
	if(focus){
		form?.focus();
		scrollToElementWithOffset(document.querySelector('main'), 0, 'auto');
	}
}

/* rules for updateProductHeading()
	on load: replace current heading with save name
	on append: do nothing
	on delete: do nothing
	on save: replace current heading with cleaned save name
	on clear: replace current heading with default
*/
function updateProductHeading(action, text = ''){
	const heading = document.getElementById('save-product-name');
	const defaultValue = document.body.classList.contains('no-storage') ? 'Your Product Information' : '';
	text = text === '' ? defaultValue : text;
	
	switch (action) {
		case "load":
			heading.textContent = text;
			break;
		
		case "save":
			heading.textContent = text;
			break;
			
		case "clear":
			heading.textContent = defaultValue;
			break;
	}
}

//show the placeholder again if input is removed from save name field
const editable = document.getElementById('save-product-name');
editable.addEventListener('input', () => {
	// remove the <br>'s that get added
	if (
		editable.childNodes.length === 1 &&
		editable.firstChild.nodeName === 'BR'
	) {
		editable.innerHTML = '';
	}
	
	//maybe a rogue space is there
	if (!editable.textContent.trim()) {
		editable.innerHTML = '';
	}
});

//adjust the secondary sticky items based on main sticky header
function recalcStickyHeaderHeight(){
	const header = document.getElementById('sticky-header');
	const adjustments = document.querySelectorAll('.sticky-top-offset');
	const height = header.offsetHeight;
	
	adjustments.forEach(el => {
		el.style.top = `${height}px`;
	});
}

//catches any change to sticky header height
const observer = new ResizeObserver(recalcStickyHeaderHeight);
observer.observe(document.getElementById('sticky-header'));

//catches veiwport resizing
window.addEventListener('resize', recalcStickyHeaderHeight);

//catches initial load
recalcStickyHeaderHeight();



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
	e.target.classList.toggle('open');
	document.getElementById('estimates').classList.toggle('open');
});

//collapsing fieldsets
document.querySelectorAll('.collapse-toggle').forEach(btn => {
	btn.addEventListener('click', e => {
		const parent = e.target.closest('fieldset');
		parent.classList.toggle('closed');
		
		const rect = parent.getBoundingClientRect();
		const isAboveViewport = rect.top < 0;
		const isBelowViewport = rect.top > window.innerHeight;
		
		if (isAboveViewport || isBelowViewport) {
			scrollToElementWithOffset(parent, 150, 'auto');
		}
	});
});



// ===============================
// service-worker for pwa
// ===============================

document.addEventListener('DOMContentLoaded', () => {
	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.register('/service-worker.js')
			.then(reg => {
				console.log('Service worker registered.');
	
				//listen for updates
				reg.onupdatefound = () => {
					const newWorker = reg.installing;
					newWorker.onstatechange = () => {
						if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
							//show update button
							openModal('update-available', 'update-app');
							const btn = document.getElementById('update-app');
							btn.addEventListener('click', () => {
								newWorker.postMessage({ action: 'skipWaiting' });
							}, { once: true });
						}
					};
				};
			})
			.catch(err => console.error('Service worker registration failed:', err));
	
		//reload page when new service worker activates
		navigator.serviceWorker.addEventListener('controllerchange', () => {
			window.location.reload();
		});
	}
});