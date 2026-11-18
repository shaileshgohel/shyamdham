"use client";
// Gujarati typing on any keyboard: while this is on, English letters typed into text fields are
// converted to Gujarati word by word ("ramesh" → રમેશ) using lib/transliterate. One instance is
// mounted in the signed-in layout and listens to every text field, so forms need no changes.
// Fields with numbers, codes, usernames and English names are skipped (see `eligible`);
// data-gu="on" / "off" on a field overrides that. Ctrl+G or the pill toggles it; the choice is remembered.
import { useCallback, useEffect, useRef, useState } from "react";
import { transliterate } from "@/lib/transliterate";
import { useG } from "./i18n-client";

const STORAGE_KEY = "sd_gu_typing";
type Field = HTMLInputElement | HTMLTextAreaElement;
const SKIP = /username|password|current|confirm|mobile|phone|\bpan\b|reg_no|registration|gst|ifsc|upi|reference|amount|rate|qty|file|payload|token|code|email|url|nameen|bank|search-no/;

function eligible(el: EventTarget | null): el is Field {
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return false;
  if (el.dataset.gu === "off") return false;
  if (el.dataset.gu === "on") return true;
  if (el.readOnly || el.disabled) return false;
  if (el instanceof HTMLInputElement && el.type !== "text" && el.type !== "search") return false;
  if (el.getAttribute("inputmode")) return false;
  return !SKIP.test(`${el.name} ${el.id}`.toLowerCase());
}

/** Set a field's value so React's onChange sees it too, then place the caret. */
function setValue(el: Field, value: string, caret: number) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
  el.setSelectionRange(caret, caret);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

type Word = { el: Field | null; start: number; latin: string; gu: string; applying: boolean };

export function GujaratiTyping() {
  const g = useG();
  const [on, setOn] = useState(true);
  const [help, setHelp] = useState(false);
  const [shown, setShown] = useState<{ latin: string; gu: string } | null>(null);
  const onRef = useRef(true);
  const word = useRef<Word>({ el: null, start: 0, latin: "", gu: "", applying: false });

  const reset = useCallback(() => {
    word.current.el = null;
    word.current.latin = "";
    word.current.gu = "";
    setShown(null);
  }, []);

  const toggle = useCallback(() => {
    const next = !onRef.current;
    onRef.current = next;
    setOn(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {
      /* private window: not remembered */
    }
    reset();
  }, [reset]);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "off") {
        onRef.current = false;
        setOn(false);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const apply = (el: Field, prefix: string, suffix: string) => {
      const w = word.current;
      w.gu = transliterate(w.latin);
      w.applying = true;
      try {
        setValue(el, prefix + w.gu + suffix, w.start + w.gu.length);
      } finally {
        w.applying = false;
      }
      setShown({ latin: w.latin, gu: w.gu });
    };

    // Desktop keyboards: convert the current word after every keystroke.
    const onInput = (e: Event) => {
      const w = word.current;
      if (w.applying || !onRef.current) return;
      const ev = e as InputEvent;
      const el = e.target;
      if (!eligible(el) || ev.isComposing) return;
      const value = el.value;
      const caret = el.selectionStart ?? value.length;
      if (ev.inputType === "insertText" && ev.data && /^[A-Za-z]+$/.test(ev.data)) {
        const typed = ev.data;
        const before = value.slice(0, caret - typed.length);
        if (w.el === el && before.length - w.gu.length === w.start && before.endsWith(w.gu)) {
          w.latin += typed; // continuing the same word
        } else {
          w.el = el;
          w.start = caret - typed.length;
          w.latin = typed;
        }
        apply(el, value.slice(0, w.start), value.slice(caret));
      } else if (ev.inputType === "insertText" && ev.data && ev.data.length > 1 && /^[A-Za-z]+[\s.,!?]*$/.test(ev.data)) {
        // A whole English word arrived at once (a phone keyboard's word with its space, a suggestion):
        // convert it and treat the word as finished. Anything with digits, symbols or Gujarati in it
        // (a pasted registration number, an autofilled address) is left exactly as it came.
        const start = caret - ev.data.length;
        if (value.slice(start, caret) === ev.data) {
          const gu = transliterate(ev.data);
          w.applying = true;
          try {
            setValue(el, value.slice(0, start) + gu + value.slice(caret), start + gu.length);
          } finally {
            w.applying = false;
          }
          setShown({ latin: ev.data.trim(), gu: gu.trim() });
          w.el = null;
          w.latin = "";
          w.gu = "";
          return;
        }
        reset();
      } else if (ev.inputType === "deleteContentBackward" && w.el === el && w.latin && w.gu.startsWith(value.slice(w.start, caret))) {
        // The browser removed one Gujarati character; redo the word from one English letter less instead.
        w.latin = w.latin.slice(0, -1);
        const prefix = value.slice(0, w.start);
        const suffix = value.slice(caret);
        if (!w.latin) {
          w.applying = true;
          try {
            setValue(el, prefix + suffix, w.start);
          } finally {
            w.applying = false;
          }
          reset();
          return;
        }
        apply(el, prefix, suffix);
      } else {
        reset(); // space, punctuation, paste, caret moved: the word is finished
      }
    };

    // Phone keyboards compose a whole word; convert it when the composition ends.
    const onCompositionEnd = (e: CompositionEvent) => {
      const el = e.target;
      if (!onRef.current || !eligible(el)) return;
      const caret = el.selectionStart ?? el.value.length;
      const before = el.value.slice(0, caret);
      const m = /[A-Za-z]+$/.exec(before);
      if (!m) return;
      const gu = transliterate(m[0]);
      word.current.applying = true;
      try {
        setValue(el, before.slice(0, m.index) + gu + el.value.slice(caret), m.index + gu.length);
      } finally {
        word.current.applying = false;
      }
      setShown({ latin: m[0], gu });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.metaKey && !e.altKey && (e.key === "g" || e.key === "G")) {
        e.preventDefault();
        toggle();
      }
    };

    document.addEventListener("input", onInput, true);
    document.addEventListener("compositionend", onCompositionEnd, true);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusout", reset);
    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("compositionend", onCompositionEnd, true);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusout", reset);
    };
  }, [reset, toggle]);

  return (
    <div className={`gu-pill${on ? " on" : ""}`} aria-live="polite">
      {help && (
        <div className="gu-help" role="dialog" aria-label={g("ગુજરાતી ટાઈપિંગ મદદ", "Gujarati typing help")}>
          <b>{g("અંગ્રેજી અક્ષરોમાં લખો, ગુજરાતી બનશે", "Type in English letters, Gujarati appears")}</b>
          <p>{g("દા.ત. ramesh → રમેશ · Rameshbhai Patel → રમેશભાઈ પટેલ · junagadh → જુનાગઢ", "e.g. ramesh → રમેશ · Rameshbhai Patel → રમેશભાઈ પટેલ · junagadh → જુનાગઢ")}</p>
          <table>
            <tbody>
              <tr><td>a અ · aa આ · i ઇ · ee ઈ · u ઉ · oo ઊ</td><td>e એ · ai ઐ · o ઓ · au ઔ · Ri ઋ</td></tr>
              <tr><td>k ક · kh ખ · g ગ · gh ઘ · ch ચ · chh છ · j જ · jh ઝ</td><td>T ટ · Th ઠ · D ડ · Dh ઢ · N ણ · t ત · th થ · d દ · dh ધ · n ન</td></tr>
              <tr><td>p પ · ph/f ફ · b બ · bh ભ · m મ · y ય · r ર · l લ · L ળ · v વ</td><td>sh શ · Sh ષ · s સ · h હ · x ક્ષ · gn જ્ઞ · M ં (chandra → ચંદ્ર)</td></tr>
            </tbody>
          </table>
          <p className="muted">{g("ખોટો અક્ષર આવે તો તે શબ્દ ફરી લખો અથવા Ctrl+G દબાવી અંગ્રેજીમાં લખો. નંબર, મોબાઈલ, PAN અને યુઝરનેમ હંમેશા અંગ્રેજીમાં રહે છે.", "If a letter comes out wrong, retype that word or press Ctrl+G to type in English. Numbers, mobile, PAN and usernames always stay in English.")}</p>
          <button type="button" className="btn sm" onClick={() => setHelp(false)}>{g("બંધ કરો", "Close")}</button>
        </div>
      )}
      <button type="button" className="gu-toggle" onClick={toggle} title={g("ગુજરાતી ટાઈપિંગ ચાલુ / બંધ (Ctrl+G)", "Gujarati typing on / off (Ctrl+G)")} aria-pressed={on}>
        <span className="gu-mark">{on ? "ગુ" : "A"}</span>
        <span className="gu-label">{on ? g("ગુજરાતી ટાઈપિંગ ચાલુ", "Gujarati typing on") : g("અંગ્રેજીમાં લખાશે", "Typing in English")}</span>
      </button>
      {on && shown && (
        <span className="gu-word">
          <span className="muted">{shown.latin}</span> → <b>{shown.gu}</b>
        </span>
      )}
      <button type="button" className="gu-q" onClick={() => setHelp((h) => !h)} aria-label={g("મદદ", "Help")}>?</button>
    </div>
  );
}
