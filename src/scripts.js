/*!
	Copyright © 2025 Justin Ludwig. All rights reserved.
	Licensed under the Business Source License 1.1 (BSL).
	See LICENSE file in the project root for details.
	
	You may not copy, distribute, or use this code commercially
	without explicit permission from the author.
*/

//todo: comment js
//todo: final refactor once inline todos are done


function toCamelCase(str) {
	return str.toLowerCase().replace(/[-_\s]+([a-z])/g, (_, letter) => letter.toUpperCase());
}

function toKebabCase(str) {
	return str.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());
}

//just want true numbers in the inputs
document.addEventListener('keydown', event => {
	if(event.target.matches('input[type="number"]') && (event.key === 'e' || event.key === 'E' || event.key === '+' || event.key === '-')){
		event.preventDefault();
	}
});

//force 2 decimal places in number inputs
document.addEventListener('blur', event => {
	if (!event.target.matches('input[type="number"]')) return;

	const raw = event.target.value.trim();

	// 0nly format if input is not empty
	if (raw === '') return;

	const value = parseFloat(raw);
	if (!isNaN(value)) {
		event.target.value = value.toFixed(2);
	}
}, true);
		
const round2 = n => Math.round(n * 100) / 100;

const valueTotalDependencies = ['expensesTotal', 'laborTotal'];
const feeKeys = Array.from(document.querySelectorAll('.fee-total')).map(el => toCamelCase(el.id));
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
		if (valueTotalDependencies.includes(key)) {
			const newValueTotal = valueTotalDependencies.reduce((sum, k) => sum + (totals[k] || 0), 0);
			totals.valueTotal = newValueTotal;
		}
		
		//automatically recalc feesTotal if any individual fee changes
		if (feeKeys.includes(key)) {
			const total = feeKeys.reduce((sum, feeKey) => sum + (totals[feeKey] || 0), 0);
			totals.feesTotal = total;
		}
		
		return true;
	}
});
totals.listingFeeTotal = 0.20;
const processingFeeFlat = 0.25;
const processingRate = 0.03;
const transactionRate = .065;
const shippingLabelInput = document.getElementById('shipping-label');
const expensesList = document.getElementById('expenses-list');
const laborList = document.getElementById('labor-list');

const templates = {
	expensesList: `<li>
			<label>
				<span class="sr-only">Material or Expense Name</span>
				<input type="text" placeholder="Material or Expense" value="{{name}}">
			</label>
			<label>Qty: <input type="number" class="expense-qty" step="0.01" min="0" placeholder="0.00" value="{{qty}}"></label>
			<label>Cost: <span class="input-unit">$</span><input type="number" class="expense-cost" step="0.01" min="0" placeholder="0.00" value="{{cost}}"></label>
			<span>Subtotal: $<output class="subtotal" role="status" aria-live="polite">0.00</output></span>
			<button type="button" class="line-item-remover" onclick="removeItem();" aria-label="Remove this line item">×</button>
		</li>`,
	laborList: `<li>
			<label>
				<span class="sr-only">Labor Type Name</span>
				<input type="text" placeholder="Labor Type" value="{{name}}">
			</label>
			<label>Hours: <input type="number" class="labor-hours" step="0.01" min="0" placeholder="0.00" value="{{hours}}"></label>
			<label>Rate: <span class="input-unit">$</span><input type="number" class="labor-rate" step="0.01" min="0" placeholder="0.00" value="{{rate}}"></label>
			<span>Subtotal: $<output class="subtotal" role="status" aria-live="polite">0.00</output></span>
			<button type="button" class="line-item-remover" onclick="removeItem();" aria-label="Remove this labor entry">×</button>
		</li>`,
	storageList: `<li data-key="{{key}}">
			<div class="file-name">{{name}}</div>
			<div class="btn-grp">
				<button type="button" onclick="loadSavedInput('{{key}}')" aria-label="Load saved setup {{name}}">Load</button>
				<button type="button" onclick="appendInput('{{key}}')" aria-label="Append saved setup {{name}}">Append</button>
				<button type="button" onclick="deleteSavedInput('{{key}}')" aria-label="Delete saved setup {{name}}">Delete</button>
			</div>
		</li>`
};


function addItem(list, replacements = {}, placement = 'append') {
	const templateKey = toCamelCase(list.id);
	const wrapper = document.createElement('div');
	let html = templates[templateKey];
	
	for(const key in replacements){
		const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
		html = html.replace(regex, replacements[key]);
	}
	//clean up any other mustaches
	html = html.replace(/{{\s*[\w]+\s*}}/g, '');
	
	wrapper.innerHTML = html;
	const newItem = wrapper.firstElementChild;
	if(placement == 'append'){
		list.append(newItem);
	} else {
		list.prepend(newItem);
	}
	
	//focus on the newly created line item
	const firstInput = newItem.querySelector('input');
	if (firstInput) {
		firstInput.focus();
	}
	
	//accessibility: update the aria-label of line-item-remover buttons so they easily know whats being removed
	const nameInput = newItem.querySelector('input[type="text"]');
	const removeButton = newItem.querySelector('.line-item-remover');
	
	if (nameInput && removeButton) {
		const updateLabel = () => {
			const val = sanitizeInput(nameInput.value) || 'blank line item';
			removeButton.setAttribute('aria-label', `Remove ${val}`);
		};
		nameInput.addEventListener('input', updateLabel);
		updateLabel();
	}
	
	return newItem;
}

//handle math for the line item lists (expense & labor)
function updateLineItemListTotal(list, totalKey) {
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

function removeItem(){
	const button = event.currentTarget || event.target;
	const listItem = button.closest('li');
	if (!listItem) return;
	listItem.remove();
	updateTotals();
}

shippingLabelInput.addEventListener('input', () => {
	const shippingCost = parseFloat(shippingLabelInput.value) || 0;
	totals.shippingLabelFeeTotal = round2(shippingCost * 0.065);
});

//income tax calculations
let incomeTaxHandler = document.querySelector('input[name="incomeTax"]:checked').value;
const incomeTaxRadios = document.querySelectorAll('input[name="incomeTax"]');
incomeTaxRadios.forEach(radio => {
	radio.addEventListener('change', () => {
		incomeTaxHandler = document.querySelector('input[name="incomeTax"]:checked').value;
		toggleIncomeTaxHandler();
		calculateListingPrice();
	});
});
function toggleIncomeTaxHandler(){
	if(incomeTaxHandler === 'ignore'){
		document.getElementById('set-aside-taxes').classList.add('hidden');
	} else {
		document.getElementById('set-aside-taxes').classList.remove('hidden');
	}
}


function calculateIncomeTax(){
	const incomeTaxRate = parseFloat((parseFloat(document.getElementById('income-tax-rate').value) / 100).toFixed(4)) || 0;
	const setAside = totals.laborTotal * incomeTaxRate;
	if(incomeTaxHandler !== 'ignore'){
		totals.incomeTaxTotal = setAside;
	} else {
		totals.incomeTaxTotal = 0;
	}
}

//fee calculations
let offsiteAdRate = parseFloat(document.querySelector('input[name="offsiteAdFee"]:checked').value) / 100;
const adFeeRadios = document.querySelectorAll('input[name="offsiteAdFee"]');
adFeeRadios.forEach(radio => {
	radio.addEventListener('change', () => {
		offsiteAdRate = parseFloat(document.querySelector('input[name="offsiteAdFee"]:checked').value) / 100;
		calculateListingPrice();
	});
});

function calculateListingPrice(){
	calculateIncomeTax();
	if(totals.valueTotal <= 0){
		totals.listingPrice = 0;
		totals.processingFeeTotal = 0;
		totals.transactionFeeTotal = 0;
		totals.taxTotal = 0;
		totals.customerTotal = 0;
		totals.offsiteAdFeeTotal = 0;
	} else{
		const totalFlatFees = totals.listingFeeTotal + processingFeeFlat;
		let net = totals.valueTotal + (incomeTaxHandler === 'factor' ? totals.incomeTaxTotal : 0);
		const shippingLabel = parseFloat(shippingLabelInput.value) || 0;
		const salesTaxRate = parseFloat((parseFloat(document.getElementById('sales-tax').value) / 100).toFixed(4)) || 0;
		
		const compoundRate = transactionRate + (processingRate * (1 + salesTaxRate)) + offsiteAdRate;
		const denominator = 1 - compoundRate;
		if (denominator > 0) {
			const listingPriceRaw = (net + (shippingLabel * compoundRate) + totalFlatFees) / denominator;
			const listingPrice = Math.ceil(listingPriceRaw * 100) / 100;
			totals.listingPrice = listingPrice;
			
			const subtotal = listingPrice + shippingLabel;
			const transactionFee = round2(listingPrice * transactionRate);
			const tax = round2(subtotal * salesTaxRate);
			const processingFee = round2((subtotal + tax) * processingRate) + processingFeeFlat;
			const offsiteAdFee = round2(subtotal * offsiteAdRate);
			
			totals.processingFeeTotal = processingFee;
			totals.transactionFeeTotal = transactionFee;
			totals.taxTotal = tax;
			totals.customerTotal = (subtotal + tax);
			totals.offsiteAdFeeTotal = offsiteAdFee;
		}
	}
}

function updateTotals(){
	updateAllLineItemLists();
	calculateListingPrice();
}

document.addEventListener('input', event => {
	if (!event.target.matches('input[type="number"]')) return;
	
	if (event.target.closest('#listing-price-calculator')){
		calculateListingPrice();
	} else if(event.target.closest('#quick-calculator')){
		calculateReturn();
	}
});

function calculateReturn(){
	const qcTax = 1.0752;
	const qcListingPrice = parseFloat(document.getElementById('qc-listing-price').value) || 0;
	const qcProcessingFee = round2((qcListingPrice * qcTax) * processingRate) + processingFeeFlat;
	const qcTransactionFee = round2(qcListingPrice * transactionRate);
	const qcFees = round2(qcProcessingFee + qcTransactionFee + totals.listingFeeTotal);
	
	totals.qcReturn = qcListingPrice - qcFees;
}


//localStorage handlers
const elpcPrefix = 'elpc_'; //prefix for localStorage items

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
}

function isStorageSupported(){
	try {
		if(!localStorage){
			return false;
		}
		const x = '__storage_test__';
		localStorage.setItem(x, x);
		localStorage.removeItem(x);
		return true;
	} catch (error){
		const quotaFull = isQuotaExceededError(error) && localStorage.length > 0;
		if(quotaFull){
			displayStorageError();
		}
		return quotaFull;
	}
}

function sanitizeInput(value){
	return value.trim().replace(/[<>]/g, '').replace(/\s+/g, ' ');
}

if(!isStorageSupported()){
	document.body.classList.add("no-storage");
} else {
	function saveInputs(){
		const saveName = sanitizeInput(document.getElementById('save-product-name').value);
		const keyName = elpcPrefix+toCamelCase(saveName);
		const inputs = {
			name: saveName,
			expenses: {},
			labor: {},
			shipping: shippingLabelInput.value,
			tax: document.getElementById('sales-tax').value,
			adRate: document.querySelector('input[name="offsiteAdFee"]:checked').value,
			taxFactor: incomeTaxHandler,
			taxRate: document.getElementById('income-tax-rate').value,
			timeStamp: Date.now()
		};
		//each of the expenses - has name & qty & cost
		let counter = 0;
		expensesList.querySelectorAll('li').forEach(li => {
			const name = sanitizeInput(li.querySelector('input[type="text"]').value);
			const qty = li.querySelector('.expense-qty').value;
			const cost = li.querySelector('.expense-cost').value;
			inputs.expenses[counter] = {name: name, qty: qty, cost: cost};
			counter++;
		});
		
		//each of the labors - has name & hours & rate
		counter = 0;
		laborList.querySelectorAll('li').forEach(li => {
			const name = sanitizeInput(li.querySelector('input[type="text"]').value);
			const hours = li.querySelector('.labor-hours').value;
			const rate = li.querySelector('.labor-rate').value;
			inputs.labor[counter] = {name: name, hours: hours, rate: rate};
			counter++;
		});
		
		try {
			localStorage.setItem(keyName, JSON.stringify(inputs));
		} catch (error){
			displayStorageError();
			return false;
		}
		
		let listItem = document.querySelector('#storage-list [data-key="'+keyName+'"]');
		
		if(listItem){
			const parent = document.getElementById('storage-list');
			parent.prepend(listItem);
		} else {
			listItem = addItem(document.getElementById('storage-list'), {name: saveName, key: keyName}, 'prepend');
		}
		
		listItem.classList.add("saved");
		setTimeout(function(){
			listItem.classList.remove("saved");
		}, 1000);
		
	}
	
	function getSavedInputs(){
		const items = {};
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key && key.startsWith(elpcPrefix)) {
				const storageItem = localStorage.getItem(key);
				const inputs = JSON.parse(storageItem);
				items[key] = inputs;
			}
		}
		const entries = Object.entries(items);
		
		entries.sort(([, a], [, b]) => b.timeStamp - a.timeStamp);
		
		entries.forEach(([key, obj]) => {
			addItem(document.getElementById('storage-list'), {name: obj.name, key: key});
		});
		
	}
	getSavedInputs();
	
	
	function clearInputs(){
		expensesList.querySelectorAll('li').forEach(li => li.remove());
		laborList.querySelectorAll('li').forEach(li => li.remove());
		shippingLabelInput.value = '';
		
		//todo: (refactor) i feel like anywhere i have this kind of stuff can be handled better
		document.getElementById('sales-tax').value = 7.52;
		document.getElementById('income-tax-rate').value = (30).toFixed(2);
		document.querySelector('input[name="offsiteAdFee"][value="0"]').checked = true;
		offsiteAdRate = parseFloat(document.querySelector('input[name="offsiteAdFee"]:checked').value) / 100;
		document.querySelector('input[name="incomeTax"][value="ignore"]').checked = true;
		incomeTaxHandler = 'ignore';
		
		updateTotals();
	}
	
	function getSingleInput(key){
		const storageItem = localStorage.getItem(key);
		const inputs = JSON.parse(storageItem);
		
		return inputs;
	}
	
	function getManufacturingCost(inputs){
		Object.entries(inputs.expenses).forEach(([key, obj]) => {
			addItem(expensesList, {name: obj.name, qty: obj.qty, cost: obj.cost});
		});
		
		Object.entries(inputs.labor).forEach(([key, obj]) => {
			addItem(laborList, {name: obj.name, hours: obj.hours, rate: obj.rate});
		});
	}
	
	function getIndirectCost(inputs){
		document.getElementById('save-product-name').value = inputs.name;
		shippingLabelInput.value = inputs.shipping;
		document.getElementById('sales-tax').value = inputs.tax;
		document.getElementById('income-tax-rate').value = inputs.taxRate;
		document.querySelector('input[name="offsiteAdFee"][value="'+inputs.adRate+'"]').checked = true;
		offsiteAdRate = parseFloat(document.querySelector('input[name="offsiteAdFee"]:checked').value) / 100;
		document.querySelector('input[name="incomeTax"][value="'+inputs.taxFactor+'"]').checked = true;
		incomeTaxHandler = inputs.taxFactor;
		toggleIncomeTaxHandler();
	}
	
	function focusTopOfForm() {
		const form = document.getElementById('listing-price-calculator');
		if (!form) return;
		form.focus({ preventScroll: true });
		//form.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
	
	function loadSavedInput(key){
		clearInputs();
		const inputs = getSingleInput(key);
		getIndirectCost(inputs);
		getManufacturingCost(inputs);
		updateTotals();
		focusTopOfForm();
	}
	
	function appendInput(key){
		const inputs = getSingleInput(key);
		getManufacturingCost(inputs);
		updateTotals();
		focusTopOfForm();
	}
	
	function deleteSavedInput(key){
		localStorage.removeItem(key);
		document.querySelector('#storage-list [data-key="'+key+'"]').remove();
	}
}