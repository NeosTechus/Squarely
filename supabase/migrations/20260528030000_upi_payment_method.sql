-- UPI scan-to-pay support: add 'upi' to the payment_method enum.
alter type payment_method add value if not exists 'upi';
