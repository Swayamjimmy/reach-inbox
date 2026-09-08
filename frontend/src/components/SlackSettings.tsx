import { useEffect, useState } from "react";
import { connectSlack, disconnectSlack, getSlackChannels, getSlackStatus, setSlackChannel, SlackChannel, SlackStatus } from "../api";

export default function SlackSettings() {
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const nextStatus = await getSlackStatus();
      setStatus(nextStatus);

      if (nextStatus.connected) {
        const nextChannels = await getSlackChannels();
        setChannels(nextChannels);
        setSelectedChannel(nextStatus.installation?.channel_id ?? "");
      } else {
        setChannels([]);
        setSelectedChannel("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Slack settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!selectedChannel) return;
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await setSlackChannel(selectedChannel);
      setMessage("Slack alert channel saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save channel");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    setError("");

    try {
      await disconnectSlack();
      setStatus({ connected: false, installation: null });
      setChannels([]);
      setSelectedChannel("");
      setMessage("Slack disconnected.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to disconnect Slack");
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) {
    return (
      <section className="settings-page">
        <div className="settings-card">
          <div className="loader" />
        </div>
      </section>
    );
  }

  return (
    <section className="settings-page">
      <div className="settings-header">
        <div>
          <div className="settings-kicker">INTEGRATIONS</div>
          <h2>Slack</h2>
          <p>Send email rate-limit alerts to a Slack channel for this workspace.</p>
        </div>
      </div>

      {error && <div className="settings-alert error">{error}</div>}
      {message && <div className="settings-alert success">{message}</div>}

      <div className="settings-card">
        {!status?.connected ? (
          <>
            <div className="slack-card-title">
              <div className="slack-logo">#</div>
              <div>
                <strong>Connect Slack</strong>
                <span>Connect this tenant to a Slack workspace.</span>
              </div>
            </div>
            <button className="slack-connect-button" onClick={() => void connectSlack()}>
              Connect Slack
            </button>
          </>
        ) : (
          <>
            <div className="slack-card-title">
              <div className="slack-logo">✓</div>
              <div>
                <strong>{status.installation?.team_name}</strong>
                <span>Slack workspace connected</span>
              </div>
            </div>

            <div className="slack-channel-field">
              <label htmlFor="slack-channel">Alert channel</label>
              <select
                id="slack-channel"
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
              >
                <option value="">Select a channel</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.isPrivate ? "🔒 " : "# "}
                    {channel.name}
                  </option>
                ))}
              </select>
              <small>Only channels where the ReachInbox Slack app is a member are shown.</small>
            </div>

            {channels.length === 0 && (
              <div className="settings-hint">
                No available channels were found. For a private channel, invite the
                ReachInbox app to that channel and reload this page.
              </div>
            )}

            <div className="settings-actions">
              <button
                className="slack-save-button"
                disabled={!selectedChannel || saving}
                onClick={() => void save()}
              >
                {saving ? "Saving..." : "Save channel"}
              </button>

              <button
                className="slack-disconnect-button"
                disabled={disconnecting}
                onClick={() => void disconnect()}
              >
                {disconnecting ? "Disconnecting..." : "Disconnect Slack"}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}