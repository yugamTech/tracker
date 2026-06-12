"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MandateStatus = exports.MandateType = exports.PaymentStatus = exports.InvoiceStatus = void 0;
var InvoiceStatus;
(function (InvoiceStatus) {
    InvoiceStatus["GENERATED"] = "GENERATED";
    InvoiceStatus["DUE"] = "DUE";
    InvoiceStatus["PAID"] = "PAID";
    InvoiceStatus["OVERDUE"] = "OVERDUE";
    InvoiceStatus["CANCELLED"] = "CANCELLED";
})(InvoiceStatus || (exports.InvoiceStatus = InvoiceStatus = {}));
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["INITIATED"] = "INITIATED";
    PaymentStatus["SUCCESS"] = "SUCCESS";
    PaymentStatus["FAILED"] = "FAILED";
    PaymentStatus["REFUNDED"] = "REFUNDED";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
var MandateType;
(function (MandateType) {
    MandateType["UPI_AUTOPAY"] = "UPI_AUTOPAY";
    MandateType["ENACH"] = "ENACH";
})(MandateType || (exports.MandateType = MandateType = {}));
var MandateStatus;
(function (MandateStatus) {
    MandateStatus["CREATED"] = "CREATED";
    MandateStatus["PENDING"] = "PENDING";
    MandateStatus["ACTIVE"] = "ACTIVE";
    MandateStatus["PAUSED"] = "PAUSED";
    MandateStatus["REVOKED"] = "REVOKED";
    MandateStatus["EXPIRED"] = "EXPIRED";
    MandateStatus["FAILED"] = "FAILED";
})(MandateStatus || (exports.MandateStatus = MandateStatus = {}));
//# sourceMappingURL=payments.js.map