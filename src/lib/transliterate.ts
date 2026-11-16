// English-letter to Gujarati transliteration for data entry, so names and addresses can be
// typed on any keyboard: "ramesh" → રમેશ, "junagadh" → જુનાગઢ, "Rameshbhai Patel" → રમેશભાઈ પટેલ.
// Pure and dependency-free; runs in the browser (see components/gujarati-typing.tsx).
//
// Conventions (also shown in the on-screen help):
//   a અ · aa/A આ · i ઇ · ee/I ઈ · u ઉ · oo/U ઊ · e એ · ai ઐ · o ઓ · au ઔ · Ri ઋ
//   k ક kh ખ g ગ gh ઘ · ch ચ chh છ j જ jh ઝ · T ટ Th ઠ D ડ Dh ઢ N ણ · t ત th થ d દ dh ધ n ન
//   p પ ph/f ફ b બ bh ભ m મ · y ય r ર l લ L ળ v/w વ · sh શ Sh ષ s સ h હ · x/ksh ક્ષ gn/jn જ્ઞ
//   M ં (anusvara) · H ઃ · an "n" or "m" before another consonant becomes ં (chandra → ચંદ્ર)
//   Common surnames, villages and words come from a dictionary, so "Patel" → પટેલ without a capital T.

const HALANT = "્";
const ANUSVARA = "ં";

// Vowels: [independent letter, matra]. Keys are matched longest first.
const VOWELS: Record<string, [string, string]> = {
  a: ["અ", ""], aa: ["આ", "ા"], A: ["આ", "ા"],
  i: ["ઇ", "િ"], ee: ["ઈ", "ી"], ii: ["ઈ", "ી"], I: ["ઈ", "ી"],
  u: ["ઉ", "ુ"], oo: ["ઊ", "ૂ"], uu: ["ઊ", "ૂ"], U: ["ઊ", "ૂ"],
  e: ["એ", "ે"], E: ["ઍ", "ૅ"], ai: ["ઐ", "ૈ"], o: ["ઓ", "ો"], O: ["ઑ", "ૉ"], au: ["ઔ", "ૌ"], ou: ["ઔ", "ૌ"],
  Ri: ["ઋ", "ૃ"], RRi: ["ઋ", "ૃ"], "Ru": ["ઋ", "ૃ"],
};

const CONSONANTS: Record<string, string> = {
  k: "ક", kh: "ખ", g: "ગ", gh: "ઘ", q: "ક",
  ch: "ચ", chh: "છ", Ch: "છ", j: "જ", jh: "ઝ", z: "ઝ", Z: "ઝ",
  T: "ટ", Th: "ઠ", D: "ડ", Dh: "ઢ", N: "ણ",
  t: "ત", th: "થ", d: "દ", dh: "ધ", n: "ન",
  p: "પ", ph: "ફ", f: "ફ", F: "ફ", b: "બ", bh: "ભ", m: "મ",
  y: "ય", Y: "ય", r: "ર", R: "ર", l: "લ", L: "ળ", v: "વ", w: "વ", V: "વ", W: "વ",
  sh: "શ", Sh: "ષ", shh: "ષ", s: "સ", S: "ષ", h: "હ",
  x: "ક્ષ", X: "ક્ષ", ksh: "ક્ષ", kSh: "ક્ષ", gn: "જ્ઞ", jn: "જ્ઞ", dny: "જ્ઞ", gy: "જ્ઞ",
  K: "ક", G: "ગ", J: "જ", P: "પ", B: "બ", C: "ક", Q: "ક",
};

const MAX_KEY = 3;

// Words whose spelling the rules cannot guess (retroflex letters, silent vowels, loan words).
// Keys are lowercase. Add freely: a wrong entry only affects that one word.
const DICT: Record<string, string> = {
  // honorifics and relations
  bhai: "ભાઈ", ben: "બેન", bahen: "બહેન", bhabhi: "ભાભી", kaka: "કાકા", kaki: "કાકી", mama: "મામા", mami: "મામી", masi: "માસી", masa: "માસા",
  dada: "દાદા", dadi: "દાદી", nana: "નાના", nani: "નાની", fua: "ફુઆ", foi: "ફોઈ", ba: "બા", bapuji: "બાપુજી", shri: "શ્રી", shree: "શ્રી", smt: "શ્રીમતી",
  shrimati: "શ્રીમતી", kumari: "કુમારી", kumar: "કુમાર", dr: "ડૉ", swa: "સ્વ", late: "સ્વ.", mataji: "માતાજી", bapa: "બાપા", maharaj: "મહારાજ", ji: "જી",
  // surnames
  patel: "પટેલ", parmar: "પરમાર", chauhan: "ચૌહાણ", chavda: "ચાવડા", solanki: "સોલંકી", rathod: "રાઠોડ", vaghela: "વાઘેલા", makwana: "મકવાણા",
  makvana: "મકવાણા", gohil: "ગોહિલ", gohel: "ગોહેલ", dabhi: "ડાભી", tank: "ટાંક", jadav: "જાદવ", yadav: "યાદવ", sodha: "સોઢા", zala: "ઝાલા",
  mori: "મોરી", dodiya: "ડોડિયા", vadher: "વાઢેર", bhatti: "ભટ્ટી", chudasama: "ચુડાસમા", sarvaiya: "સરવૈયા", thakkar: "ઠક્કર", thakor: "ઠાકોર",
  shah: "શાહ", joshi: "જોષી", dave: "દવે", desai: "દેસાઈ", mehta: "મહેતા", trivedi: "ત્રિવેદી", pandya: "પંડ્યા", vyas: "વ્યાસ", bhatt: "ભટ્ટ",
  modi: "મોદી", rana: "રાણા", gadhvi: "ગઢવી", kadia: "કડિયા", kadiya: "કડિયા", mistry: "મિસ્ત્રી", mistri: "મિસ્ત્રી", suthar: "સુથાર", luhar: "લુહાર",
  soni: "સોની", darji: "દરજી", prajapati: "પ્રજાપતિ", vankar: "વણકર", vaniya: "વાણિયા", baraiya: "બારૈયા", chandra: "ચંદ્ર", kathiriya: "કાઠીરિયા",
  // villages and places
  junagadh: "જુનાગઢ", junagarh: "જુનાગઢ", vanthali: "વંથલી", vanthli: "વંથલી", keshod: "કેશોદ", manavadar: "માણાવદર", visavadar: "વિસાવદર",
  mangrol: "માંગરોળ", mendarda: "મેંદરડા", bhesan: "ભેસાણ", maliya: "માળિયા", hatina: "હાટીના", bilkha: "બિલખા", rajkot: "રાજકોટ", ahmedabad: "અમદાવાદ",
  amdavad: "અમદાવાદ", surat: "સુરત", mumbai: "મુંબઈ", vadodara: "વડોદરા", baroda: "વડોદરા", porbandar: "પોરબંદર", veraval: "વેરાવળ", somnath: "સોમનાથ",
  gujarat: "ગુજરાત", bhavnagar: "ભાવનગર", jamnagar: "જામનગર", gondal: "ગોંડલ", dhoraji: "ધોરાજી", upleta: "ઉપલેટા", talala: "તાલાળા", una: "ઉના",
  madhuram: "મધુરમ", zanzarda: "ઝાંઝરડા", timbavadi: "ટીંબાવાડી", joshipara: "જોષીપરા", gandhigram: "ગાંધીગ્રામ", dolatpara: "દોલતપરા",
  motibaug: "મોતીબાગ", motibag: "મોતીબાગ", khalilpur: "ખલીલપુર", girnar: "ગિરનાર", sakkarbaug: "સક્કરબાગ", kalwa: "કાળવા", kalva: "કાળવા",
  // address words
  road: "રોડ", society: "સોસાયટી", soc: "સોસાયટી", nagar: "નગર", park: "પાર્ક", chowk: "ચોક", chok: "ચોક", sheri: "શેરી", plot: "પ્લોટ", flat: "ફ્લેટ",
  bunglow: "બંગલો", bungalow: "બંગલો", bunglows: "બંગલોઝ", apartment: "એપાર્ટમેન્ટ", school: "સ્કૂલ", hospital: "હોસ્પિટલ", mandir: "મંદિર", temple: "ટેમ્પલ",
  station: "સ્ટેશન", bus: "બસ", stand: "સ્ટેન્ડ", main: "મેઈન", gate: "ગેટ", colony: "કોલોની", complex: "કોમ્પ્લેક્સ", tower: "ટાવર", heights: "હાઈટ્સ",
  residency: "રેસિડેન્સી", villa: "વિલા", house: "હાઉસ", near: "પાસે", pase: "પાસે", opp: "સામે", same: "સામે", pachhal: "પાછળ", bajar: "બજાર", bazar: "બજાર",
  street: "સ્ટ્રીટ", line: "લાઈન", circle: "સર્કલ", highway: "હાઈવે", office: "ઓફિસ", bank: "બેંક", vistar: "વિસ્તાર", gam: "ગામ", gaam: "ગામ",
  // events, accounts and portal words
  lagna: "લગ્ન", lagan: "લગ્ન", sagai: "સગાઈ", besnu: "બેસણું", besanu: "બેસણું", janmadivas: "જન્મદિવસ", birthday: "બર્થડે", katha: "કથા", puja: "પૂજા",
  pooja: "પૂજા", bhojan: "ભોજન", daan: "દાન", dan: "દાન", fund: "ફંડ", cheque: "ચેક", check: "ચેક", bill: "બિલ", deposit: "ડિપોઝિટ", hall: "હોલ", wadi: "વાડી",
  vadi: "વાડી", rasodu: "રસોડું", light: "લાઈટ", gas: "ગેસ", ac: "એસી", kursi: "ખુરશી", khurshi: "ખુરશી", thali: "થાળી", vatki: "વાટકી", glass: "ગ્લાસ",
  tapelu: "તપેલું", gadla: "ગાદલા", gadlu: "ગાદલું", chadar: "ચાદર", table: "ટેબલ", sound: "સાઉન્ડ", mandap: "મંડપ", pani: "પાણી", paani: "પાણી",
  pagar: "પગાર", safai: "સફાઈ", repair: "રિપેર", repairing: "રિપેરિંગ", kharch: "ખર્ચ", aavak: "આવક", javak: "જાવક", stationery: "સ્ટેશનરી",
  contractor: "કોન્ટ્રાક્ટર", builder: "બિલ્ડર", engineer: "એન્જિનિયર", doctor: "ડોક્ટર", vepar: "વેપાર", nokri: "નોકરી", kheti: "ખેતી",
  nivrutt: "નિવૃત્ત", nivrut: "નિવૃત્ત", abhyas: "અભ્યાસ", gruhini: "ગૃહિણી", kaam: "કામ", kam: "કામ", sarkari: "સરકારી", shikshak: "શિક્ષક",
  trust: "ટ્રસ્ટ", samaj: "સમાજ", gnati: "જ્ઞાતિ", jnati: "જ્ઞાતિ", samiti: "સમિતિ", utsav: "ઉત્સવ", karyakram: "કાર્યક્રમ", sabha: "સભા",
  meeting: "મીટિંગ", shyamdham: "શ્યામધામ", shyam: "શ્યામ", krishna: "કૃષ્ણ", krushna: "કૃષ્ણ", radhe: "રાધે", jay: "જય", jai: "જય", om: "ૐ",
  mobile: "મોબાઈલ", phone: "ફોન", email: "ઈમેલ", whatsapp: "વોટ્સએપ", online: "ઓનલાઈન", upi: "UPI", neft: "NEFT", rtgs: "RTGS", pan: "PAN",
  // given names the rules get wrong
  lakshmi: "લક્ષ્મી", laxmi: "લક્ષ્મી", ganesh: "ગણેશ", gita: "ગીતા", geeta: "ગીતા", sita: "સીતા", jyoti: "જ્યોતિ", nita: "નીતા", neeta: "નીતા",
  hetal: "હેતલ", kinjal: "કિંજલ", hardik: "હાર્દિક", kirit: "કિરીટ", kiran: "કિરણ", bharat: "ભરત", bhavna: "ભાવના", bhavana: "ભાવના", rahul: "રાહુલ",
  nitin: "નિતિન", manish: "મનીષ", kalpesh: "કલ્પેશ", alpesh: "અલ્પેશ", prakash: "પ્રકાશ", kanti: "કાંતિ", kanu: "કનુ", bhanu: "ભાનુ", dilip: "દિલીપ",
  kanji: "કાનજી", ramji: "રામજી", lalji: "લાલજી", natha: "નાથા", harji: "હરજી", dhiru: "ધીરુ", hansa: "હંસા", kamla: "કમળા", kamala: "કમળા",
  sharda: "શારદા", mina: "મીના", meena: "મીના", rekha: "રેખા", manjula: "મંજુલા", kamlesh: "કમલેશ", riya: "રિયા", aryan: "આર્યન", ved: "વેદ",
  kunal: "કુણાલ", krunal: "કૃણાલ", nisha: "નિશા", mohan: "મોહન", vinod: "વિનોદ", babu: "બાબુ", jiva: "જીવા", amrut: "અમૃત", amrit: "અમૃત",
  prabhu: "પ્રભુ", bhagwan: "ભગવાન", shanti: "શાંતિ", kanta: "કાંતા", savita: "સવિતા", jaya: "જયા", lila: "લીલા", leela: "લીલા", hira: "હીરા", heera: "હીરા",
  divya: "દિવ્યા", vaishali: "વૈશાલી", anjali: "અંજલિ", sharma: "શર્મા", pushpa: "પુષ્પા", ratna: "રત્ના", vimla: "વિમળા", vimala: "વિમળા", urmila: "ઉર્મિલા", usha: "ઉષા", asha: "આશા", nirmala: "નિર્મળા", sarla: "સરલા",
  devi: "દેવી", dev: "દેવ", maya: "માયા", pinal: "પિનલ", payal: "પાયલ", krupa: "કૃપા", shruti: "શ્રુતિ", dipak: "દીપક", deepak: "દીપક", dipika: "દીપિકા",
  vipul: "વિપુલ", ketan: "કેતન", chetan: "ચેતન", jitu: "જીતુ", jitendra: "જીતેન્દ્ર", mahendra: "મહેન્દ્ર", narendra: "નરેન્દ્ર", rajendra: "રાજેન્દ્ર",
  bhupendra: "ભૂપેન્દ્ર", upendra: "ઉપેન્દ્ર", gautam: "ગૌતમ", tushar: "તુષાર", kishor: "કિશોર", ishwar: "ઈશ્વર", vishnu: "વિષ્ણુ", shiv: "શિવ",
  mahadev: "મહાદેવ", hanuman: "હનુમાન", ram: "રામ", sanjay: "સંજય", vijay: "વિજય", ajay: "અજય", amit: "અમિત", rohit: "રોહિત", pankaj: "પંકજ",
};

// Name + suffix combinations ("Rameshbhai", "Nitaben", "Kiritkumar") split before lookup.
const SUFFIXES = ["bhai", "ben", "bahen", "bhabhi", "kumar", "kumari", "kaka", "kaki", "mama", "mami", "masi", "dada", "dadi", "ji"];

const isVowelStart = (s: string) => /^[aeiouAEIOU]/.test(s);
const NASAL_NEXT = /^(k|kh|g|gh|ch|chh|j|jh|T|Th|D|Dh|t|th|d|dh|p|ph|f|b|bh|s|sh|Sh|h)/;

function core(word: string): string {
  let out = "";
  let i = 0;
  let pendingConsonant = false; // last thing written was a consonant without a vowel yet
  let conjunctTail: string | null = null; // the consonant key written after a halant we inserted (the "r" of "dr")
  const n = word.length;
  while (i < n) {
    // Word-final short vowels in names are long: Ganga → ગંગા, Priya → પ્રિયા, Bharti → ભારતી.
    // Except after a conjunct ending in r or y: chandra → ચંદ્ર, Mitra → મિત્ર, Satya → સત્ય.
    if (pendingConsonant && i === n - 1 && (word[i] === "a" || word[i] === "i")) {
      if (!(word[i] === "a" && conjunctTail && /^[ry]$/.test(conjunctTail))) out += word[i] === "a" ? "ા" : "ી";
      pendingConsonant = false;
      break;
    }
    // word-final "ai" is almost always ાઈ in Gujarati names (Desai, Nai, Sai, Rai)
    if (pendingConsonant && word.slice(i) === "ai") {
      out += "ાઈ";
      pendingConsonant = false;
      break;
    }
    // "n"/"m" before another consonant → anusvara (chandra → ચંદ્ર, samba → સંબા), not at word start
    if ((word[i] === "n" || word[i] === "m") && i > 0 && NASAL_NEXT.test(word.slice(i + 1)) && !isVowelStart(word.slice(i + 1))) {
      out += ANUSVARA;
      pendingConsonant = false;
      i += 1;
      continue;
    }
    if (word[i] === "M") { out += ANUSVARA; pendingConsonant = false; i += 1; continue; }
    if (word[i] === "H" && (i + 1 >= n || !/[a-zA-Z]/.test(word[i + 1]))) { out += "ઃ"; pendingConsonant = false; i += 1; continue; }
    if (word[i] === "~") { out += "ઁ"; pendingConsonant = false; i += 1; continue; }

    let matched = false;
    for (let len = Math.min(MAX_KEY, n - i); len >= 1; len--) {
      const chunk = word.slice(i, i + len);
      if (VOWELS[chunk]) {
        const [indep, matra] = VOWELS[chunk];
        out += pendingConsonant ? matra : indep;
        pendingConsonant = false;
        i += len;
        matched = true;
        break;
      }
      if (CONSONANTS[chunk]) {
        conjunctTail = pendingConsonant ? chunk : null;
        if (pendingConsonant) out += HALANT;
        out += CONSONANTS[chunk];
        pendingConsonant = true;
        i += len;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    // "c" alone: soft before e/i, hard otherwise
    if (word[i] === "c") {
      if (pendingConsonant) out += HALANT;
      out += /[ei]/.test(word[i + 1] ?? "") ? "સ" : "ક";
      pendingConsonant = true;
      i += 1;
      continue;
    }
    out += word[i];
    pendingConsonant = false;
    i += 1;
  }
  return out;
}

function lookup(word: string): string | null {
  const lower = word.toLowerCase();
  if (DICT[lower]) return DICT[lower];
  for (const suf of SUFFIXES) {
    if (lower.length > suf.length + 1 && lower.endsWith(suf)) {
      const base = word.slice(0, word.length - suf.length);
      return transliterateWord(base) + DICT[suf];
    }
  }
  return null;
}

/** One word (letters only). Case matters for T/D/N/L/S/Sh, except an all-caps word, which is treated as lowercase. */
export function transliterateWord(word: string): string {
  if (!word) return "";
  const hit = lookup(word);
  if (hit) return hit;
  let w = word;
  if (w.length > 1 && w === w.toUpperCase()) w = w.toLowerCase();
  // A capital first letter is just capitalisation, not a retroflex request (Tank, Thakkar come from the dictionary).
  else if (/^[A-Z][a-z]/.test(w)) w = w[0].toLowerCase() + w.slice(1);
  return core(w);
}

/** Whole string: Latin letter runs are converted, everything else (digits, spaces, punctuation, Gujarati) is kept. */
export function transliterate(text: string): string {
  return text.replace(/[A-Za-z]+/g, (m) => transliterateWord(m));
}
