import { MAX_MOOD_NOTE_LENGTH } from "../../types";

type NoteInputProps = {
  value: string;
  onChange: (value: string) => void;
};

const trimToMaxCharacters = (value: string): string =>
  [...value].slice(0, MAX_MOOD_NOTE_LENGTH).join("");

const countCharacters = (value: string): number => [...value].length;

export function NoteInput({ value, onChange }: NoteInputProps) {
  const characterCount = countCharacters(value);

  return (
    <label className="note-input">
      <span className="note-input__header">
        <span className="note-input__label">Optional note</span>
        <span className="note-input__count">
          {characterCount}/{MAX_MOOD_NOTE_LENGTH}
        </span>
      </span>
      <textarea
        maxLength={MAX_MOOD_NOTE_LENGTH}
        onChange={(event) => onChange(trimToMaxCharacters(event.currentTarget.value))}
        placeholder="A few words for the other person"
        rows={3}
        value={value}
      />
    </label>
  );
}
