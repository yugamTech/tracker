"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotifCategory = exports.NotifStatus = exports.NotifChannel = void 0;
var NotifChannel;
(function (NotifChannel) {
    NotifChannel["PUSH"] = "PUSH";
    NotifChannel["SMS"] = "SMS";
    NotifChannel["WHATSAPP"] = "WHATSAPP";
})(NotifChannel || (exports.NotifChannel = NotifChannel = {}));
var NotifStatus;
(function (NotifStatus) {
    NotifStatus["PENDING"] = "PENDING";
    NotifStatus["SENT"] = "SENT";
    NotifStatus["DELIVERED"] = "DELIVERED";
    NotifStatus["FAILED"] = "FAILED";
})(NotifStatus || (exports.NotifStatus = NotifStatus = {}));
var NotifCategory;
(function (NotifCategory) {
    NotifCategory["TRIP_START"] = "TRIP_START";
    NotifCategory["TRIP_END"] = "TRIP_END";
    NotifCategory["BOARDING"] = "BOARDING";
    NotifCategory["ALIGHTING"] = "ALIGHTING";
    NotifCategory["PICKUP_CANCELLED"] = "PICKUP_CANCELLED";
    NotifCategory["OVERSPEED"] = "OVERSPEED";
    NotifCategory["COMPLAINT_UPDATE"] = "COMPLAINT_UPDATE";
    NotifCategory["PAYMENT_DUE"] = "PAYMENT_DUE";
    NotifCategory["PAYMENT_SUCCESS"] = "PAYMENT_SUCCESS";
})(NotifCategory || (exports.NotifCategory = NotifCategory = {}));
//# sourceMappingURL=notifications.js.map