-- Default account heads, money accounts, facilities and rate card, so a fresh or upgraded
-- database works without running the seed. Rates are examples; change them in the portal.
-- Safe to re-run: nothing is overwritten.

INSERT INTO "AccountHead" ("type", "nameGu", "nameEn", "systemKey", "sortOrder") VALUES
  ('INCOME', 'સામાન્ય દાન', 'General donation', 'donation_general', 0),
  ('INCOME', 'બાંધકામ ફંડ', 'Building fund', NULL, 1),
  ('INCOME', 'ભોજન / અન્નક્ષેત્ર દાન', 'Food donation', NULL, 2),
  ('INCOME', 'શિક્ષણ સહાય દાન', 'Education aid donation', NULL, 3),
  ('INCOME', 'વાડી ભાડા આવક', 'Wadi rent', 'booking_rent', 4),
  ('INCOME', 'નુકસાની વસૂલાત', 'Damage recovery', 'booking_damage', 5),
  ('INCOME', 'સભ્ય ફી', 'Membership fee', NULL, 6),
  ('INCOME', 'બેંક વ્યાજ', 'Bank interest', NULL, 7),
  ('INCOME', 'અન્ય આવક', 'Other income', NULL, 8),
  ('EXPENSE', 'લાઈટ બિલ', 'Electricity', NULL, 9),
  ('EXPENSE', 'પાણી બિલ', 'Water', NULL, 10),
  ('EXPENSE', 'પગાર', 'Salaries', NULL, 11),
  ('EXPENSE', 'રિપેરિંગ / મેન્ટેનન્સ', 'Repairs & maintenance', NULL, 12),
  ('EXPENSE', 'બાંધકામ ખર્ચ', 'Construction', NULL, 13),
  ('EXPENSE', 'ઉત્સવ / કાર્યક્રમ ખર્ચ', 'Events', NULL, 14),
  ('EXPENSE', 'સફાઈ ખર્ચ', 'Cleaning', NULL, 15),
  ('EXPENSE', 'વાસણ / સામાન ખરીદી', 'Utensils & supplies', NULL, 16),
  ('EXPENSE', 'ઓફિસ / સ્ટેશનરી', 'Office & stationery', NULL, 17),
  ('EXPENSE', 'શિક્ષણ સહાય ચુકવણી', 'Education aid paid', NULL, 18),
  ('EXPENSE', 'અન્ય ખર્ચ', 'Other expenses', NULL, 19)
ON CONFLICT DO NOTHING;

INSERT INTO "MoneyAccount" ("kind", "name", "bankDetails", "openingDate", "sortOrder")
SELECT v.kind, v.name, v.details,
       make_date(CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 4 THEN EXTRACT(YEAR FROM CURRENT_DATE)::int ELSE EXTRACT(YEAR FROM CURRENT_DATE)::int - 1 END, 4, 1),
       v.ord
FROM (VALUES ('CASH', 'રોકડ', NULL, 0), ('BANK', 'મુખ્ય બેંક ખાતું', 'બેંકનું નામ અને ખાતા નં. અહીં લખો', 1)) AS v(kind, name, details, ord)
WHERE NOT EXISTS (SELECT 1 FROM "MoneyAccount");

INSERT INTO "Facility" ("nameGu", "nameEn", "memberRate", "nonMemberRate", "deposit", "sortOrder")
SELECT * FROM (VALUES ('વાડી હોલ', 'Wadi hall', 15000, 20000, 5000, 0), ('રસોડું', 'Kitchen', 3000, 4000, 1000, 1), ('ઉપરનો હોલ', 'Upper hall', 5000, 7000, 2000, 2)) AS v
WHERE NOT EXISTS (SELECT 1 FROM "Facility");

INSERT INTO "ChargeItem" ("nameGu", "unit", "rate", "sortOrder")
SELECT * FROM (VALUES ('વાસણ સેટ (100 વ્યક્તિ)', 'સેટ', 400, 0), ('ગેસ', 'બાટલો', 1100, 1), ('લાઈટ / સફાઈ ચાર્જ', 'દિવસ', 1500, 2), ('વધારાની ખુરશી', 'નંગ', 5, 3), ('AC ચાર્જ', 'દિવસ', 2000, 4)) AS v
WHERE NOT EXISTS (SELECT 1 FROM "ChargeItem");
