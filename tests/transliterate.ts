// Unit check for the English → Gujarati typing helper: `npx tsx tests/transliterate.ts`.
import { transliterate } from "../src/lib/transliterate";

const cases = [
  ["ramesh", "રમેશ"], ["Rameshbhai Patel", "રમેશભાઈ પટેલ"], ["Nitaben", "નીતાબેન"], ["mahesh", "મહેશ"], ["Jayesh Chauhan", "જયેશ ચૌહાણ"],
  ["junagadh", "જુનાગઢ"], ["Madhuram Society, Zanzarda Road", "મધુરમ સોસાયટી, ઝાંઝરડા રોડ"], ["Desai", "દેસાઈ"], ["Jain", "જૈન"],
  ["chandra", "ચંદ્ર"], ["sanjay", "સંજય"], ["Hemant", "હેમંત"], ["pankaj", "પંકજ"], ["Ganga", "ગંગા"], ["Sinh", "સિંહ"],
  ["geeta", "ગીતા"], ["Suresh Solanki", "સુરેશ સોલંકી"], ["Kiritkumar", "કિરીટકુમાર"], ["shree", "શ્રી"], ["Dr. Jyoti Dabhi", "ડૉ. જ્યોતિ ડાભી"],
  ["Hardik 9000000031", "હાર્દિક 9000000031"], ["Krishna", "કૃષ્ણ"], ["Vaishali", "વૈશાલી"], ["mukesh", "મુકેશ"], ["Paresh", "પરેશ"],
  ["Thakkar", "ઠક્કર"], ["Dilipbhai Vaghela", "દિલીપભાઈ વાઘેલા"], ["Bhavnaben Tank", "ભાવનાબેન ટાંક"], ["Lagna", "લગ્ન"], ["besnu", "બેસણું"],
  ["Ramjibhai", "રામજીભાઈ"], ["aanand", "આનંદ"], ["Daxa", "દક્ષા"], ["Mittal", "મિત્તલ"], ["gokul", "ગોકુલ"], ["Vinodbhai Rathod", "વિનોદભાઈ રાઠોડ"],
  ["RAMESH", "રમેશ"], ["Sharma", "શર્મા"], ["Mitra", "મિત્ર"], ["Satya", "સત્ય"], ["Divya", "દિવ્યા"], ["Bhaarati", "ભારતી"], ["Shilpa", "શિલ્પા"],
  ["Chetan", "ચેતન"], ["Dhiru", "ધીરુ"], ["Rama", "રમા"], ["Sonaali", "સોનાલી"], ["Indra", "ઇંદ્ર"], ["HarSha", "હર્ષા"], ["Tapelu 50 li", "તપેલું 50 લી"], ["Priya", "પ્રિયા"], ["Dharmesh", "ધર્મેશ"], ["Hiteshkumar", "હિતેશકુમાર"],
];
let fail = 0;
for (const [input, want] of cases) {
  const got = transliterate(input);
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${input.padEnd(34)} → ${got}${ok ? "" : `   (wanted ${want})`}`);
}
console.log(fail ? `\n${fail} of ${cases.length} failed` : `\nall ${cases.length} passed`);
process.exit(fail ? 1 : 0);
