"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";

type Common = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Validation message; shown once the field was touched. */
  error?: string | null;
  /** Show the gold check mark. */
  valid?: boolean;
  hint?: string;
  maxLength?: number;
  dir?: "ltr" | "rtl";
  autoFocus?: boolean;
  onBlur?: () => void;
  /** Reveal the error even if the field was never touched (e.g. after "continue" was pressed). */
  showErrors?: boolean;
};

type Props =
  | (Common & {
      as?: "input";
      type?: string;
      inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
      autoComplete?: string;
      /** Suggestions shown while typing; any other value is still allowed. */
      suggestions?: readonly string[];
    })
  | (Common & { as: "textarea"; rows?: number })
  | (Common & { as: "select"; options: string[] });

/** Input with a floating label, gold focus ring and instant (but polite) validation feedback. */
export function FloatingField(props: Props) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);
  const floated = focused || props.value.length > 0;
  const showError = (touched || !!props.showErrors) && !focused && !!props.error;

  const shared = {
    id,
    value: props.value,
    maxLength: props.maxLength,
    dir: props.dir,
    autoFocus: props.autoFocus,
    "aria-invalid": showError || undefined,
    "aria-describedby": `${id}-msg`,
    onFocus: () => setFocused(true),
    onBlur: () => {
      setFocused(false);
      setTouched(true);
      props.onBlur?.();
    },
    className: "peer w-full bg-transparent text-[16px] text-cream outline-none placeholder:text-transparent",
  };

  return (
    <div>
      <div
        className={`field relative !p-0 ${showError ? "!border-danger/60 !shadow-[0_0_0_4px_rgba(229,103,90,0.12)]" : ""}`}
        onClick={(e) => (e.currentTarget.querySelector("input,textarea,select") as HTMLElement | null)?.focus()}
      >
        <label
          htmlFor={id}
          className={`pointer-events-none absolute right-4 origin-right transition-all duration-200 ease-out ${
            floated ? "top-2 scale-[0.78] text-gold-2/90" : "top-[1.05rem] text-mute"
          }`}
        >
          {props.label}
        </label>

        {props.as === "textarea" ? (
          <textarea {...shared} rows={props.rows ?? 4} onChange={(e) => props.onChange(e.target.value)} className={`${shared.className} resize-none pt-7 pr-4 pb-3 pl-10 leading-relaxed`} />
        ) : props.as === "select" ? (
          <select {...shared} onChange={(e) => props.onChange(e.target.value)} className={`${shared.className} appearance-none px-4 pt-6 pb-2 ${props.value ? "" : "text-transparent"}`}>
            <option value="" disabled hidden />
            {props.options.map((o) => (
              <option key={o} value={o} className="bg-ink-2 text-cream">
                {o}
              </option>
            ))}
          </select>
        ) : (
          <input
            {...shared}
            type={props.type ?? "text"}
            inputMode={props.inputMode}
            autoComplete={props.autoComplete}
            list={props.suggestions ? `${id}-list` : undefined}
            placeholder={props.label}
            onChange={(e) => props.onChange(e.target.value)}
            className={`${shared.className} h-[58px] px-4 pt-5 pr-4 pl-11`}
          />
        )}

        {props.as !== "textarea" && props.as !== "select" && props.suggestions && (
          <datalist id={`${id}-list`}>
            {props.suggestions.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        )}
        <AnimatePresence>
          {props.valid && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              className="absolute top-[1.1rem] left-3.5 grid h-5 w-5 place-items-center rounded-full bg-gold text-ink"
            >
              <Check size={12} strokeWidth={3.5} />
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div id={`${id}-msg`} className="flex min-h-5 items-start justify-between gap-2 px-1 pt-1.5 text-[11.5px]">
        <AnimatePresence mode="wait" initial={false}>
          {showError ? (
            <motion.span key="err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-danger">
              {props.error}
            </motion.span>
          ) : (
            <motion.span key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-mute-2">
              {props.hint}
            </motion.span>
          )}
        </AnimatePresence>
        {props.maxLength && props.as === "textarea" && (
          <span className={`tabular shrink-0 ${props.value.length > props.maxLength * 0.9 ? "text-gold-2" : "text-mute-2"}`}>
            {props.value.length}/{props.maxLength}
          </span>
        )}
      </div>
    </div>
  );
}
