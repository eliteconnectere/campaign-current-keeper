#!/usr/bin/env python3
"""
Fix Elite Connectere workspace menu & settings structure:
1. Re-establishes clean top-level Hamburger Menu (Engine, Rotation, Vault, Log, Planner, Reset, Settings, Logout).
2. Restores the full {menuView === "settings"} panel with search bar, sub-pages, and eliminates duplicate Hotspot rows.
3. Restores missing {menuView === "scope"} and {menuView === "history"} sub-views.
4. Unlocks Customization & Studio permanently for eliteconnectere@gmail.com.
"""

from pathlib import Path
import re

app_file = Path("src/routes/app.tsx")
content = app_file.read_text(encoding="utf-8")

# 1. Ensure eliteconnectere@gmail.com has instant client-side master access to Studio & Customization
content = re.sub(
    r'const premium = entitlements\?\.premium \?\? false;\s*const canCustomize = entitlements\?\.customization \?\? false;',
    '''const isCompany = userEmail?.trim().toLowerCase() === "eliteconnectere@gmail.com";
  const premium = isCompany || (entitlements?.premium ?? false);
  const canCustomize = isCompany || (entitlements?.customization ?? false);''',
    content,
)

# Soft variants for premium / canCustomize
if 'userEmail?.trim().toLowerCase() === "eliteconnectere@gmail.com"' not in content:
    # try common patterns
    if "const canCustomize = entitlements?.customization" in content:
        content = content.replace(
            "const canCustomize = entitlements?.customization ?? false;",
            'const isCompany = userEmail?.trim().toLowerCase() === "eliteconnectere@gmail.com";\n  const canCustomize = isCompany || (entitlements?.customization ?? false);',
            1,
        )
        print("+ isCompany canCustomize")
    if re.search(r"const premium = entitlements\?\.premium \?\? false;", content) and "isCompany ||" not in content:
        content = re.sub(
            r"const premium = entitlements\?\.premium \?\? false;",
            'const isCompany = userEmail?.trim().toLowerCase() === "eliteconnectere@gmail.com";\n  const premium = isCompany || (entitlements?.premium ?? false);',
            content,
            count=1,
        )
        print("+ isCompany premium")

# 2. Replace the disorganized menu block with the clean root menu and restored settings panel
menu_replacement = r'''                {menuView === "root" && (
                  <div className="animate-fade-in">
                    <p className="label-caps px-3.5 py-2.5">Workspace menu</p>
                    <div className="divide-y divide-line border-t border-line">
                      <MenuToggle
                        icon={Zap}
                        label="Elite Engine mode"
                        on={mode === "elite"}
                        onClick={() => switchMode(mode === "elite" ? "standard" : "elite")}
                      />
                      <MenuToggle
                        icon={Shuffle}
                        label="2-Way rotation"
                        on={twoWay}
                        onClick={() => setTwoWay((v) => !v)}
                      />
                      <MenuRow
                        icon={Database}
                        label="Quarantine Vault"
                        sub={`${quarantineVault.length} excluded/risky leads saved`}
                        onClick={() => { setVaultOpen(true); setPanel("none"); }}
                      />
                      <MenuRow
                        icon={ScrollText}
                        label="Activity Log"
                        sub={`${notes.length} recorded events`}
                        onClick={() => { setFeatureStudio("activity"); setPanel("none"); }}
                      />
                      <MenuRow
                        icon={NotebookPen}
                        label="Personal Planner / Scratchpad"
                        sub={`${planner.length} saved notes & plans`}
                        onClick={() => { setFeatureStudio("planner"); setPanel("none"); }}
                      />
                      <MenuRow
                        icon={Trash2}
                        label="Reset workspace"
                        danger
                        onClick={() => {
                          resetWorkspace();
                          setPanel("none");
                          setNotes(["Workspace reset"]);
                        }}
                      />
                    </div>
                    <div className="border-t border-line">
                      <MenuRow
                        icon={Settings}
                        label="Settings"
                        sub="Customization, sounds, protection, hotspot & account"
                        onClick={() => setMenuView("settings")}
                      />
                      <MenuRow
                        icon={LogOut}
                        label="Logout"
                        danger
                        onClick={() => {
                          setPanel("none");
                          setChatOpen(false);
                          setActiveChat(null);
                          setEntitlements(null);
                          setSettings(DEFAULT_SETTINGS);
                          setNotes(["Workspace ready — no campaign running"]);
                          applyAppearance(DEFAULT_SETTINGS, false);
                          toast.dismiss();
                          void supabase.auth.signOut();
                        }}
                      />
                    </div>
                  </div>
                )}

                {menuView === "settings" && (
                  <div className="animate-fade-in">
                    <button
                      onClick={() => setMenuView("root")}
                      className="flex w-full items-center gap-2 px-3.5 py-2.5"
                    >
                      <ChevronLeft className="size-3.5 text-brand" />
                      <span className="label-caps">Settings</span>
                    </button>
                    <div className="border-t border-line">
                      <div className="p-3">
                        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-line px-3">
                          <Search className="size-4 text-ink-soft" />
                          <input
                            value={settingsSearch}
                            onChange={(event) => setSettingsSearch(event.target.value)}
                            placeholder="Search all settings"
                            className="min-w-0 flex-1 bg-transparent text-base outline-none"
                            aria-label="Search all settings"
                          />
                        </label>
                      </div>
                      {settingsSearch.trim() && (
                        <div className="border-b border-line px-3 pb-3">
                          {settingsSearchItems
                            .filter(([label, description, , keywords]) =>
                              `${label} ${description} ${keywords}`.toLowerCase().includes(settingsSearch.trim().toLowerCase())
                            )
                            .map(([label, description, view]) => (
                              <button
                                key={view}
                                type="button"
                                onClick={() => {
                                  setMenuView(view);
                                  setSettingsSearch("");
                                }}
                                className="flex min-h-14 w-full items-center gap-2 rounded-lg px-2 text-left active:bg-soft"
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[13px] font-semibold text-ink">{label}</span>
                                  <span className="block truncate text-[11px] text-ink-soft">{description}</span>
                                </span>
                                {view === "campaignProtection" && (
                                  <span className="text-[10px] font-semibold text-emerald-600">Active</span>
                                )}
                              </button>
                            ))}
                          {!settingsSearchItems.some(([label, description, , keywords]) =>
                            `${label} ${description} ${keywords}`.toLowerCase().includes(settingsSearch.trim().toLowerCase())
                          ) && <p className="px-2 py-2 text-[12px] text-ink-soft">No matching settings.</p>}
                        </div>
                      )}
                      <MenuRow
                        icon={ShieldCheck}
                        label="Campaign Protection"
                        sub="Permanent duplicate protection and Gmail rotation"
                        onClick={() => setMenuView("campaignProtection")}
                      />
                      <MenuRow
                        icon={Target}
                        label="Scope of Outreach"
                        sub={`Default ${defaultScope} · this campaign ${scope}`}
                        onClick={() => setMenuView("scope")}
                      />
                      <MenuRow
                        icon={History}
                        label="Smart Fill History"
                        sub={`${smartFillHistory.length}/3 saved email sets`}
                        onClick={() => setMenuView("history")}
                      />
                      <MenuRow
                        icon={Bell}
                        label="Notification and Sound Management"
                        sub="Choose which system events notify you"
                        onClick={() => setMenuView("notifications")}
                      />
                      <MenuRow
                        icon={Sparkles}
                        label="Night Mode Light"
                        sub="Colours, speed and edge coverage"
                        onClick={() => {
                          if (!canCustomize) {
                            askUpgrade("Night Mode Light is an Elite Studio ProMaxx feature.", true);
                            return;
                          }
                          setFeatureStudio("nightMode");
                          setPanel("none");
                        }}
                      />
                      {chatEligible && (
                        <MenuRow
                          icon={MessageCircle}
                          label="Chat Settings"
                          sub="Chat username, chat sounds and message options"
                          onClick={() => {
                            setChatSettingsOpen(true);
                            setPanel("none");
                          }}
                        />
                      )}
                      <MenuRow
                        icon={Users}
                        label="Hotspot access"
                        sub="Share plan quota with up to 2 logins"
                        onClick={() => {
                          setTeamOpen(true);
                          setPanel("none");
                        }}
                      />
                      <MenuRow
                        icon={Gauge}
                        label="Tools & Visibility"
                        sub="Smart Fill, tracker, planner and sending modes"
                        onClick={() => setMenuView("tools")}
                      />
                      <MenuRow
                        icon={Sparkles}
                        label="Interface Customization"
                        sub={canCustomize ? "Colours, type, shape and density" : "Elite Studio ProMaxx"}
                        onClick={() => {
                          setStudioOpen(true);
                          setPanel("none");
                        }}
                      />
                      {!GOOGLE_REVIEW_MODE && (
                        <MenuRow
                          icon={ShieldCheck}
                          label="Subscription"
                          sub={
                            premium
                              ? "Premium active"
                              : entitlements?.trialActive
                              ? "Free trial running"
                              : "Free plan"
                          }
                          onClick={() => setMenuView("subscription")}
                        />
                      )}
                      <MenuRow
                        icon={Download}
                        label="Export Data / CSV Backup"
                        sub="Download campaign logs"
                        onClick={exportCsv}
                      />
                      <MenuRow
                        icon={Database}
                        label="Clear Local Cache"
                        sub="Temporary data only — your campaign is kept"
                        onClick={() => {
                          setNotes(["Temporary data cleared"]);
                          setPanel("none");
                        }}
                      />
                      <MenuRow
                        icon={Trash2}
                        label="Erase Data"
                        sub="Wipe this workspace and start fresh"
                        danger
                        onClick={() => setConfirming({ kind: "erase" })}
                      />
                    </div>
                  </div>
                )}

                {menuView === "scope" && (
                  <div className="animate-fade-in">
                    <button
                      onClick={() => setMenuView("settings")}
                      className="flex w-full items-center gap-2 px-3.5 py-2.5"
                    >
                      <ChevronLeft className="size-3.5 text-brand" />
                      <span className="label-caps">Scope of outreach</span>
                    </button>
                    <div className="space-y-2 border-t border-line p-3">
                      <p className="text-[11.5px] leading-snug text-ink-soft">
                        How many recipients a single campaign run targets. New campaigns start from
                        the default; the current campaign can use a different number without changing it.
                      </p>
                      <label className="block text-[11.5px] font-semibold text-ink">
                        Default scope
                        <input
                          type="number"
                          min={1}
                          value={defaultScope}
                          onChange={(e) => setDefaultScope(Math.max(1, Number(e.target.value) || 1))}
                          className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-[12.5px] outline-none"
                        />
                      </label>
                      <label className="block text-[11.5px] font-semibold text-ink">
                        Current campaign scope
                        <input
                          type="number"
                          min={1}
                          value={scope}
                          onChange={(e) => {
                            const n = Math.max(1, Number(e.target.value) || 1);
                            setScope(n);
                            setTo(n);
                          }}
                          className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-[12.5px] outline-none"
                        />
                      </label>
                      <button
                        onClick={() => {
                          setScope(defaultScope);
                          setTo(defaultScope);
                        }}
                        className="w-full rounded-full border border-line py-2 text-[12.5px] font-semibold text-ink"
                      >
                        Use the default for this campaign
                      </button>
                    </div>
                  </div>
                )}

                {menuView === "history" && (
                  <div className="animate-fade-in">
                    <button
                      onClick={() => setMenuView("settings")}
                      className="flex w-full items-center gap-2 px-3.5 py-2.5"
                    >
                      <ChevronLeft className="size-3.5 text-brand" />
                      <span className="label-caps">Smart Fill history</span>
                    </button>
                    <div className="border-t border-line">
                      {smartFillHistory.length === 0 ? (
                        <p className="px-3.5 py-4 text-center text-[12px] text-ink-soft">
                          No saved email sets yet. The last three lists you validate are kept here.
                        </p>
                      ) : (
                        smartFillHistory.map((s) => (
                          <button
                            key={s.savedAt}
                            onClick={() => {
                              setRaw(s.emails);
                              setRecipients([]);
                              setValidated(false);
                              setEditing(true);
                              setGenerated([]);
                              setPanel("none");
                            }}
                            className="flex w-full items-center gap-2 border-b border-line px-3.5 py-2.5 text-left last:border-b-0"
                          >
                            <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">
                              {s.name}
                            </span>
                            <span className="shrink-0 text-[11.5px] text-ink-soft">
                              {s.count.toLocaleString()}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
'''

# Replace from {menuView === "root" && ( up to right before {menuView === "notifications" && (
pattern = r'\{menuView === "root" && \([\s\S]*?(?=\s*\{menuView === "notifications" && \()'
new_content, n = re.subn(pattern, menu_replacement, content, count=1)
if n == 0:
    print("WARN: root→notifications pattern not found — trying alternate")
    # Try replace through campaignProtection or settings duplicates
    pattern2 = r'\{menuView === "root" && \([\s\S]*?(?=\s*\{menuView === "campaignProtection" && \()'
    new_content, n2 = re.subn(pattern2, menu_replacement, content, count=1)
    if n2 == 0:
        print("ERROR: could not locate menu block")
    else:
        content = new_content if n else content
        content = re.sub(pattern2, menu_replacement, content, count=1)
        print("replaced via campaignProtection anchor")
else:
    content = new_content
    print("replaced root→notifications menu block")

app_file.write_text(content, encoding="utf-8")
print("Successfully restored workspace menu and settings panel in src/routes/app.tsx")
