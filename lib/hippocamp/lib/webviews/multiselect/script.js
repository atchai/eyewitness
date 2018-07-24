/*
 * Validates the webview form.
 */
window.validateForm = function (form) {

	var numSelected = 0;

	// Count the number of selected items.
	for (var index = 0; index < form.elements.length; index++) {
		var field = form.elements[index];
		if (field.checked) { numSelected++; }
	}

	// Check the minimum number of items has been selected.
	if (numSelected < 1) {
		event.preventDefault();
		alert('You must select at least one item!');
		return false;
	}

	return true;

};
