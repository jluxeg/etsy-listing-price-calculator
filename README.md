# Etsy Listing Price Calculator
A simple, browser-based tool to help Etsy sellers determine optimal listing prices while accounting for the seller's fees.

[Use the calculator now](https://jluxeg.github.io/etsy-listing-price-calculator/)  
coming soon - Video Demo

![Mockups showing the Etsy Listing Price Calculator on various devices](./img/elpc-mockup.jpg)

## Why I Built This

I've had a shop on Etsy for some time and I had been meaning to put this tool together for a little while because doing the math on paper was getting tedious.  
Sure, after setting up a listing you can guess and check with Etsy's built-in estimate on the listing price, but this can get annoying to rely on especially if you handle a lot of custom orders.  
Etsy also has this [Google Sheet](https://docs.google.com/spreadsheets/d/16j_fqx8doCKfzEwk5sG9ebP381c7N1ZHCAcVqR2f1yQ/edit), but with it being structured around yearly profits (and not including all of the fees) it can be a little confusing for new or small shop owners to get a handle on.  
So whether you're new to Etsy or seasoned shop owner, I hope this calculator becomes a helpful tool in your belt.

*This tool is not sponsored or endorsed by Etsy in any way.*

## Features
- Calculates manufacturing and indirect costs based on materials, expenses, labor, and fees, to provide you with a suggested listing price
- Ability to factor in offsite ad fees or income tax to help plan better
- Auto-updates calculations as you fill in the fields
- Save, load, and append listing product setups
- Responsive, accessible interface
- There's also a quick calculator like what Etsy has, but a bit quicker to get to


## How To Use It
1. **Add your materials and expenses.**  
Things like what you used to make and ship your product. Label it, enter how much you used, and the unit price. These will typically make up your deductible costs.
2. **Add in your labor.**  
Consider how much time each step of your process takes you. Label it, enter your time, and your desired hourly rate. These will typically make up your net profits.  
If "labor" doesn't really make sense for your listing, say for a digital product, you can enter your flat profits you'd like to get simply by putting '1' for hour and the your desired profit in the corresponding rate field.
3. **Modify fee dependent values.**  
The cost of the shipping label and the state sales tax will have a factor in determining the total fees. Change these as needed.
4. **Consider offsite ad fees _(optional)_.**  
You can use this to get an idea of what to expect to owe on this listing if it applies to an order.
5. **Plan for income tax _(optional)_.**  
Use this to see how much to expect or plan to set aside for your taxes. The view option is good for if you've worked this into your hourly rate, or you're fine pocketing less than your net. The factor option is good for if you haven't worked into your hourly rate, or would like to receive your full net amount.  
*I am not a tax professional, and this tool can not be used for legal advice.*
6. **View your estimated totals.**  
Now you should have a better idea of what the different fees will be like for your listing and how you should value your product.
7. **Save your product setup.**  
Then you can easily get back and make updates quickly. With the append option you can even create setups for common material or labor sets (like packaging materials) and quickly add them to your current setup.


## The Stack
- HTML, CSS, JavaScript (Vanilla)
- Accessible, semantic markup
- No frameworks or build dependencies


## Possible Enhancements
- Currently built towards US based Etsy shops, so figuring out and adding in other countries fee setups could be helpful for more users.
- A system to save/print pdfs of setups for invoicing or personal records could be helpful, nice if there's the ability to add logo and header info for a professional touch.
- Might make into an app (ionic or otherwise) if user desire is there, but the manifest does a decent job right now.
- Maybe line-items could be re-ordered with drag and drop if the value is there.
- Might add an import/export for save files, since they are tied to device and browser using local storage and no capability for user profiles.
- On the dev side scripts and styles could be packaged and minified, but for now it's still relatively small, so maybe later.


---

## Contributing
Found a bug or have an idea to make the tool better? [let me know](https://github.com/jluxeg/etsy-listing-price-calculator/issues)  
If you’d like to suggest an improvement or fix a bug, please check out the [CONTRIBUTING.md](./CONTRIBUTING.md) file for details.

## License
Copyright (C) 2025 Justin Ludwig  
This project is licensed under a [Business Source License (BSL 1.1)](./LICENSE).  
You’re free to use this project to calculate and explore results, but the source code itself may not be copied, redistributed, or used commercially without permission.
