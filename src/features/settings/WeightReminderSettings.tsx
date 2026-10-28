import { Group, InfoRow } from "./SettingsGroup";

// owned by settings stream: this file is yours (the reminder switch and the reminder day, W4, P52). The
// section is already mounted in SettingsPage, so that page needs no change. Placeholder below: replace it.

/** Settings: the weight reminder switch and the reminder day. */
export function WeightReminderSettings() {
  return (
    <Group title="Weight reminder">
      <InfoRow label="Reminder" value="Being built" />
    </Group>
  );
}
