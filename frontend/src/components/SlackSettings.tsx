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
      <section className="max-w-[900px] mx-auto mt-[55px] px-6">
        <div className="bg-white border border-[#e4e8e5] rounded-xl p-6 shadow-[0_3px_15px_rgba(20,30,24,0.04)]">
          <div className="w-[25px] h-[25px] border-2 border-[#e5e8e6] border-t-[#00a63c] rounded-full animate-spin" />
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[900px] mx-auto mt-[55px] px-6">
      <div className="mb-6">
        <div>
          <div className="text-[#00a744] text-[11px] font-bold tracking-[0.08em] mb-1.5">INTEGRATIONS</div>
          <h2 className="m-0 mb-[7px] text-[25px] font-semibold text-[#27302b]">Slack</h2>
          <p className="m-0 text-[#7b847e] text-[13px]">Send email rate-limit alerts to a Slack channel for this workspace.</p>
        </div>
      </div>

      {error && <div className="max-w-[900px] mb-3 p-[10px_13px] rounded-[7px] text-[12px] bg-[#fff1f1] text-[#b33b3b]">{error}</div>}
      {message && <div className="max-w-[900px] mb-3 p-[10px_13px] rounded-[7px] text-[12px] bg-[#effaf2] text-[#258047]">{message}</div>}

      <div className="bg-white border border-[#e4e8e5] rounded-xl p-6 shadow-[0_3px_15px_rgba(20,30,24,0.04)]">
        {!status?.connected ? (
          <>
            <div className="flex items-center gap-[13px] mb-[25px]">
              <div className="w-[38px] h-[38px] rounded-[9px] grid place-items-center bg-[#f0f5f1] text-[#00a744] font-bold text-[17px]">#</div>
              <div className="flex flex-col gap-1">
                <strong className="text-[15px] text-[#303832]">Connect Slack</strong>
                <span className="text-[12px] text-[#8b938d]">Connect this tenant to a Slack workspace.</span>
              </div>
            </div>
            <button className="h-[40px] rounded-[7px] px-[17px] bg-[#00a744] text-white text-[13px] font-semibold" onClick={() => void connectSlack()}>
              Connect Slack
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-[13px] mb-[25px]">
              <div className="w-[38px] h-[38px] rounded-[9px] grid place-items-center bg-[#f0f5f1] text-[#00a744] font-bold text-[17px]">✓</div>
              <div className="flex flex-col gap-1">
                <strong className="text-[15px] text-[#303832]">{status.installation?.team_name}</strong>
                <span className="text-[12px] text-[#8b938d]">Slack workspace connected</span>
              </div>
            </div>

            <div className="flex flex-col gap-[7px] max-w-[520px]">
              <label htmlFor="slack-channel" className="text-[12px] text-[#59625c] font-semibold">Alert channel</label>
              <select
                id="slack-channel"
                className="h-[40px] border border-[#dce2de] rounded-[7px] px-[11px] bg-white text-[#38413b] outline-none"
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
              <small className="text-[#969e99] text-[11px]">Only channels where the ReachInbox Slack app is a member are shown.</small>
            </div>

            {channels.length === 0 && (
              <div className="mt-[15px] p-[11px_13px] bg-[#f8faf8] rounded-[7px] text-[#727b75] text-[12px] leading-relaxed">
                No available channels were found. For a private channel, invite the ReachInbox app to that channel and reload this page.
              </div>
            )}

            <div className="flex items-center gap-[10px] mt-6">
              <button
                className="h-[40px] rounded-[7px] px-[17px] bg-[#00a744] text-white text-[13px] font-semibold disabled:opacity-55 disabled:cursor-not-allowed"
                disabled={!selectedChannel || saving}
                onClick={() => void save()}
              >
                {saving ? "Saving..." : "Save channel"}
              </button>
              <button
                className="h-[40px] rounded-[7px] px-[15px] bg-white border border-[#e0e4e1] text-[#68716b] text-[13px] disabled:opacity-55 disabled:cursor-not-allowed"
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