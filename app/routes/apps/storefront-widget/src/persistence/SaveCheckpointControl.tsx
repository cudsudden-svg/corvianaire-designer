// Explicit "Save" control. Clones the current autosaved DRAFT into a new
// named checkpoint — the draft itself keeps autosaving independently
// afterward. No version history beyond this: each save is an independent
// snapshot (see design.server.ts's saveCheckpoint()).
import { useState } from "react";
import { designClient } from "../api/client";

interface SaveCheckpointControlProps {
  designId: string | null;
}

export function SaveCheckpointControl({ designId }: SaveCheckpointControlProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!designId || !name.trim()) return;
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const checkpoint = await designClient.saveCheckpoint(designId, name.trim());
      setSavedMessage(`Saved as "${checkpoint.name}"`);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save design");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="corvianaire-save-checkpoint">
      <input
        type="text"
        placeholder='Name this design (e.g. "Birthday shirt")'
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={!designId || saving}
      />
      <button type="button" onClick={() => void handleSave()} disabled={!designId || saving || !name.trim()}>
        {saving ? "Saving…" : "Save design"}
      </button>
      {savedMessage && <p className="corvianaire-save-success">{savedMessage}</p>}
      {error && <p className="corvianaire-save-error">{error}</p>}
    </div>
  );
}
