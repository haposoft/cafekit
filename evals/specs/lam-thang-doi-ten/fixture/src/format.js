// Display helpers used by this app's own routes and reports.
function fmtName(customer) {
  return `${customer.lastName.toUpperCase()}, ${customer.firstName}`;
}
module.exports = { fmtName };
