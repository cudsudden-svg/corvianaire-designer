import { useEffect } from "react";

export function useKeyboardShortcuts(
  onDelete: () => void
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Delete" ||
        event.key === "Backspace"
      ) {
        onDelete();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [onDelete]);
}