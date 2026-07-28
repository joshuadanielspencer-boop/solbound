// ===========================================================================
// THE SIDE PANEL — every screen the player reads, as a shallow tree instead of
// five long scrolls.
//
// THE PROBLEM THIS FIXES, in Joshua's words: "the game presents SO MUCH
// information all at once, and most of it text that you have to scroll
// through." He was right, and the shape of the fix is his too — go deeper
// rather than longer, and hide prose behind a hover.
//
// THE STRUCTURE. Each tab is a menu of labelled ways in; each way in is a screen
// with a back arrow. Nothing is longer than the panel, so nothing scrolls.
//
//   ⚓ Dock      → Market · Propellant · Wait · This port · Newspaper
//   🔧 Yard      → Repair · Drive · Modules · Crew · Ships · Escape pod
//   🧭 Course    → (list of destinations) → one destination
//   ⚖ Standing  → (list of factions) → one faction
//
// THE ATLAS IS NOT A TAB. It used to be a fifth menu — a list of systems you
// opened to read about places you were looking at on the map two feet to the
// left. Now clicking a planet opens that system on the map AND puts its atlas
// here, so the words and the picture are the same act. It also takes a whole
// menu of text off the screen, which was the point.
//
// Every menu button carries the number you would have gone in to read, so most
// of the time you do not have to: "Market — 4 worth carrying", "Crew — $320/day",
// "Propellant — 30/30 t". The tree is for acting, not for looking things up.
//
// WHAT GOES ON A ROW AND WHAT GOES IN THE BUBBLE. On the row: what you choose
// between — name, price, tonnage, which bay it needs. In the hover bubble: why
// it exists, what it teaches, the sentence that is worth reading once and then
// never again. ui.jsx explains why the bubble is absolutely positioned.
// ===========================================================================

import { useState } from "react";
import {
  Screen, NavButton, InfoRow, RowMain, RowValue, PricePair, Tag, StatStrip, PrimaryButton, Footnote,
  money, fmtDate, fmtDur,
} from "./ui.jsx";
import { siteOf, techOf, govOf, TECH_LEVELS } from "../data/sites.js";
import { SYSTEM_BY_ID } from "../data/bodies.js";
import { COMMODITY_BY_ID, TIERS } from "../data/commodities.js";
import { listing } from "../market.js";
import { buyPrice, sellPrice, cargoUsed, cargoCapacity, cargoFree } from "../player.js";
import { factionAt } from "../factions.js";
import { reputationTrack, repAt, repLedger, REP_MIN, REP_MAX } from "../reputation.js";
import { runPlan, cargoValueAt } from "../intel.js";
import { atlasFor, atlasProgress } from "../atlas.js";
import { systemInfo, generateNews } from "../worldinfo.js";
import { fittedStats, MODULE_BY_ID, HULL_BY_ID, ESCAPE_POD, slotUsage } from "../data/hulls.js";
import { shipsForSale, modulesForSale, tradeInValue, repairCost, drivesForSale, driveTradeIn } from "../shipyard.js";
import { crewForHire, effectiveSkills, dailyWages, berthsFree } from "../crew.js";
import { CREW_BY_ID, berthsFor } from "../data/crew.js";
import { SKILLS } from "../data/captain.js";
import { controlledCargo, illegalCargo } from "../encounters.js";
import { DRIVES, tankAfter } from "../propulsion.js";
import {
  destinations, fuelPrice, tankMax, dailyCost, tripCost, paperPrice, rangeReport, CRYO_FACTOR,
} from "../tradergame.js";

// ---------------------------------------------------------------------------
// The router
// ---------------------------------------------------------------------------

export default function Panel({ game, mode, dest, setDest, actions }) {
  // One screen per tab, remembered while you are on that tab and reset when you
  // leave it — coming back to the Yard should not drop you inside the crew list.
  const [screen, setScreen] = useState(null);
  const [lastMode, setLastMode] = useState(mode);
  if (mode !== lastMode) { setLastMode(mode); setScreen(null); }
  const back = () => setScreen(null);

  if (mode === "dock") return <Dock game={game} screen={screen} go={setScreen} back={back} actions={actions} />;
  if (mode === "yard") return <Yard game={game} screen={screen} go={setScreen} back={back} actions={actions} />;
  if (mode === "travel") return <Course game={game} dest={dest} setDest={setDest} actions={actions} />;
  return <Standing game={game} screen={screen} go={setScreen} back={back} />;
}

// ---------------------------------------------------------------------------
// DOCK
// ---------------------------------------------------------------------------

function Dock({ game, screen, go, back, actions }) {
  const p = game.player;
  const site = siteOf(game, p.at);
  const market = game.markets[p.at];
  const info = systemInfo(game, p.at);
  // NOTHING A PORT DOES NOT TRADE. Listing them taught what a place cannot get,
  // and it also put six dead rows in front of a player trying to find the live
  // ones — Joshua's call, and the right one: a thing you cannot act on is not a
  // choice. What you cannot AFFORD still shows, because that is a choice.
  const rows = listing(market, site);
  const traded = rows;
  const fp = fuelPrice(game);
  const news = generateNews(game);
  const paid = game.paperAt === p.at;
  const range = rangeReport(game);

  if (screen === "market") return <MarketScreen game={game} rows={rows} back={back} actions={actions} />;
  if (screen === "fuel") return <FuelScreen game={game} back={back} actions={actions} />;
  if (screen === "wait") return <WaitScreen game={game} back={back} actions={actions} />;
  if (screen === "port") return <PortScreen game={game} back={back} />;
  if (screen === "news") return <NewsScreen game={game} back={back} actions={actions} />;

  // How many goods here are actually worth loading — the one number that
  // answers "is there anything for me at this port".
  const worth = traded.filter((r) => r.produces || r.ratio > 1.5).length;

  return (
    <Screen title={site.name} hint={`${info?.tech.name} · ${info?.gov.type} · pop. ${info?.population.toLocaleString()}`}>
      {/* Labels a player can read without being told what they mean. "In reach"
          and "Per day" were shorthand for my own benefit — the first is how many
          ports you could launch for right now, the second was a wage bill. */}
      <StatStrip items={[
        { label: "Cargo hold", value: `${cargoUsed(p).toFixed(0)}/${cargoCapacity(p).toFixed(0)} t`,
          hint: "Tonnes aboard, out of what this ship can carry" },
        { label: "Propellant", value: `${p.ship.fuelTonnes.toFixed(0)}/${tankMax(p).toFixed(0)} t`,
          tone: p.ship.fuelTonnes < tankMax(p) * 0.2 ? "hot" : undefined,
          hint: "Tonnes in the tank, out of what it holds" },
        { label: "Ports in reach", value: `${range.now} of ${range.total}`, tone: range.now ? undefined : "hot",
          hint: "How many ports you could launch for on the propellant aboard. A fuller hold reaches fewer." },
        { label: "Crew wages", value: dailyCost(game) ? `${money(dailyCost(game))}/day` : "none",
          tone: dailyCost(game) ? "hot" : undefined,
          hint: "Paid every day, whether the ship is earning or not" },
      ]} />

      <NavButton icon="⚖" label="Market" onClick={() => go("market")}
        note={`${traded.length} good${traded.length === 1 ? "" : "s"} on the shelves`}
        value={worth ? `${worth} worth carrying` : "nothing cheap"} tone={worth ? "gold" : undefined} />
      <NavButton icon="⛽" label="Propellant" onClick={() => go("fuel")}
        note={fp ? `${money(fp)} a tonne here` : "not sold at this port"}
        value={`${p.ship.fuelTonnes.toFixed(0)}/${tankMax(p).toFixed(0)} t`} />
      <NavButton icon="⏳" label="Wait here" onClick={() => go("wait")}
        note="Let a shortage bite, or a glut clear"
        value={dailyCost(game) ? `${money(dailyCost(game))}/day` : "free"} tone={dailyCost(game) ? "hot" : "ok"} />
      <NavButton icon="🏛" label="This port" onClick={() => go("port")}
        note="Who runs it, how it is policed, why it is here"
        value={info?.pirateWord ? `☠ ${info.pirateWord}` : undefined} />
      <NavButton icon="📰" label={news.paper} onClick={() => go("news")}
        note={paid ? "Read" : `${news.items.length} ${news.items.length === 1 ? "story" : "stories"} on the wire`}
        value={paid ? "read" : money(paperPrice(game))} tone={paid ? "ok" : "gold"} />
    </Screen>
  );
}

/** The market. One line per good; the lesson is on hover. */
function MarketScreen({ game, rows, back, actions }) {
  const p = game.player;
  const site = siteOf(game, p.at);
  const market = game.markets[p.at];
  const [sel, setSel] = useState(null);

  return (
    <Screen title="Market" onBack={back}
      hint={`◆ made here · ○ imported · ${money(p.credits)} · ${cargoFree(p).toFixed(0)} t free`}>
      {rows.map((r) => {
        const held = p.cargo[r.id] || 0;
        const bp = buyPrice(p, market, site, r.id), sp = sellPrice(p, market, site, r.id);
        const cost = Math.round(p.costBasis?.[r.id] || 0);
        const on = sel === r.id;
        return (
          <div key={r.id}>
            <InfoRow info={<><b>{r.name}.</b> {r.note}{r.lesson ? <> <i>{r.lesson}</i></> : null}</>}
              selected={on} onActivate={() => setSel(on ? null : r.id)}>
              <RowMain
                name={`${r.produces ? "◆ " : r.consumes ? "○ " : ""}${r.name}`}
                tags={<>
                  {r.banned && <Tag tone="hot">illegal here</Tag>}
                  {r.contraband && !r.banned && <Tag tone="ok">legal here</Tag>}
                  {held > 0 && <Tag tone="gold">{held} t aboard</Tag>}
                  {held > 0 && cost > 0 && (
                    <Tag tone={sp >= cost ? "ok" : "hot"}>
                      {sp >= cost ? "+" : "−"}{money(Math.abs(sp - cost))}/t
                    </Tag>
                  )}
                </>}
                sub={r.state}
              />
              <PricePair buy={money(bp)} sell={money(sp)} />
            </InfoRow>
            {on && <TradeBar row={r} held={held} bp={bp} sp={sp} paid={cost}
              free={cargoFree(p)} credits={p.credits} actions={actions} />}
          </div>
        );
      })}
    </Screen>
  );
}

function TradeBar({ row, held, bp, sp, paid, free, credits, actions }) {
  const maxBuy = Math.max(0, Math.min(Math.floor(free), Math.floor(credits / bp), Math.floor(row.stock)));
  const [qty, setQty] = useState(1);
  const q = Math.min(qty, Math.max(maxBuy, held, 1));
  return (
    <div style={ST.trade}>
      {held > 0 && paid > 0 && (
        <div style={{ fontSize: 11.5, color: sp >= paid ? "#3E9B6E" : "var(--hot)", marginBottom: 7 }}>
          You paid {money(paid)}/t — selling {Math.min(q, held)} t now is a
          {sp >= paid ? " profit" : " loss"} of {money(Math.abs((sp - paid) * Math.min(q, held)))}.
        </div>
      )}
      <div style={ST.tradeRow}>
        <div style={ST.stepper}>
          <button style={ST.step} onClick={() => setQty((v) => Math.max(1, v - 1))} aria-label="Fewer">−</button>
          <span style={ST.qty}>{q} t</span>
          <button style={ST.step} onClick={() => setQty((v) => v + 1)} aria-label="More">+</button>
          <button style={ST.step} onClick={() => setQty(Math.max(1, maxBuy))} title="As many as you can afford and hold">max</button>
        </div>
        <div style={ST.stepper}>
          <button style={{ ...ST.buy, opacity: maxBuy > 0 ? 1 : 0.4 }} disabled={maxBuy <= 0}
            onClick={() => actions.buy(row.id, q)}>Buy</button>
          <button style={{ ...ST.sell, opacity: held > 0 ? 1 : 0.4 }} disabled={held <= 0}
            onClick={() => actions.sell(row.id, Math.min(q, held))}>Sell</button>
        </div>
      </div>
    </div>
  );
}

function FuelScreen({ game, back, actions }) {
  const p = game.player;
  const fp = fuelPrice(game);
  const tank = tankMax(p), freeT = tank - p.ship.fuelTonnes;
  const range = rangeReport(game);
  const drive = DRIVES[p.ship.drive] || DRIVES.methalox;
  const stats = fittedStats(p.ship.hull, p.ship.modules);
  const perMonth = p.ship.fuelTonnes - tankAfter(p.ship.fuelTonnes, drive, 30, stats?.cryo ? CRYO_FACTOR : 1);

  return (
    <Screen title="Propellant" onBack={back}
      hint={fp ? `${money(fp)} a tonne at this port` : "This port does not sell propellant"}>
      <StatStrip items={[
        { label: "In the tank", value: `${p.ship.fuelTonnes.toFixed(1)} t` },
        { label: "Capacity", value: `${tank.toFixed(0)} t` },
        { label: "Ports in reach", value: `${range.now} of ${range.total}` },
        { label: "With a full tank", value: `${range.full}`, tone: range.full > range.now ? "gold" : undefined },
      ]} />
      {fp && freeT > 0.5 && (
        <>
          <PrimaryButton onClick={() => actions.refuel(freeT)}>
            Fill the tank — {money(fp * freeT)} for {freeT.toFixed(1)} t
          </PrimaryButton>
          <PrimaryButton tone="quiet" onClick={() => actions.refuel(Math.min(10, freeT))}>
            Take on 10 t — {money(fp * Math.min(10, freeT))}
          </PrimaryButton>
        </>
      )}
      {fp && freeT <= 0.5 && <Footnote>The tank is full.</Footnote>}
      {perMonth > 0.01 && (
        <Footnote>
          ❄ This drive runs on hydrogen and is boiling off about <b>{perMonth.toFixed(1)} t a month</b>
          {stats?.cryo ? ", even with the cryocooler running" : " — nothing aboard is chilling it"}. It goes on
          wherever you are.
        </Footnote>
      )}
      <Footnote>
        A fuller hold reaches fewer ports: mass is what the rocket equation charges for, so
        cargo and range trade against each other on every trip.
      </Footnote>
    </Screen>
  );
}

function WaitScreen({ game, back, actions }) {
  const perDay = dailyCost(game);
  return (
    <Screen title="Wait here" onBack={back}
      hint={perDay > 0 ? `${money(perDay)} a day in wages` : "Costs you nothing but the date"}>
      {[7, 30, 90].map((d) => (
        <NavButton key={d} icon="⏳" label={`Wait ${d} days`} onClick={() => actions.wait(d)}
          note={`to ${fmtDate(game.t + d * 86400000)}`}
          value={perDay > 0 ? money(perDay * d) : "free"} tone={perDay > 0 ? "hot" : "ok"} />
      ))}
      <Footnote>
        Prices drift back toward what a place structurally pays. Waiting sells a glut down and
        lets a shortage bite — against a wage bill, and a calendar that does not come back.
      </Footnote>
    </Screen>
  );
}

function PortScreen({ game, back }) {
  const site = siteOf(game, game.player.at);
  const info = systemInfo(game, game.player.at);
  const control = factionAt(game.factions, site.id);
  const rep = repAt(game, site.id);
  const gov = govOf(site);
  if (!info) return null;
  return (
    <Screen title={site.name} onBack={back} hint={SYSTEM_BY_ID[site.system]?.name}>
      <StatStrip items={[
        { label: "Tech", value: info.tech.name },
        { label: "Police", value: info.policeWord },
        { label: "Pirates", value: info.pirateWord, tone: /Swarms|Many/.test(info.pirateWord) ? "hot" : undefined },
        { label: "Population", value: info.population.toLocaleString() },
      ]} />
      <InfoRow info={info.tech.note}><RowMain name="Tech level" sub="What this port can build for you" /><RowValue top={info.tech.name} /></InfoRow>
      <InfoRow info={`${gov.blurb || info.gov.type}. Law here runs at about ${Math.round((gov.law || 0) * 100)}% — that is how often a patrol stops you, and how hard it is to talk your way past one.`}>
        <RowMain name="Government" sub="Who makes the rules" /><RowValue top={info.gov.type} />
      </InfoRow>
      {control && rep && (
        <InfoRow info={control.faction.blurb}>
          <RowMain name={control.faction.name} sub="Holds this port" />
          <RowValue top={rep.tier.name} bottom={`${rep.standing > 0 ? "+" : ""}${rep.standing}`}
            tone={rep.standing >= 15 ? "ok" : rep.standing <= -30 ? "hot" : undefined} />
        </InfoRow>
      )}
      <InfoRow info={site.why}><RowMain name="Why anyone is here" sub="The physical reason" /><RowValue top="hover" /></InfoRow>
      <Footnote>{info.pressure}</Footnote>
    </Screen>
  );
}

function NewsScreen({ game, back, actions }) {
  const news = generateNews(game);
  const paid = game.paperAt === game.player.at;
  const tone = { crisis: "var(--hot)", danger: "var(--hot)", opportunity: "#3E9B6E", market: "var(--gold)" };
  return (
    <Screen title={news.paper} onBack={back} hint={news.reachNote}>
      {paid ? (
        news.items.map((it, i) => (
          <div key={i} style={ST.headline}>
            <span style={{ color: tone[it.kind] || "var(--muted)" }}>▍</span> {it.headline}
          </div>
        ))
      ) : (
        <>
          <Footnote>
            {news.items.length} {news.items.length === 1 ? "story" : "stories"} on the wire today.
            This game's whole thesis is that information is a resource, so the paper is not free.
          </Footnote>
          <PrimaryButton onClick={actions.buyPaper}>Buy a copy — {money(paperPrice(game))}</PrimaryButton>
        </>
      )}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// YARD
// ---------------------------------------------------------------------------

function Yard({ game, screen, go, back, actions }) {
  const p = game.player;
  const site = siteOf(game, p.at);
  const hull = HULL_BY_ID[p.ship.hull];
  const slots = slotUsage(p.ship.hull, p.ship.modules);
  const dmg = 100 - (p.ship.hullPct ?? 100);
  const berths = berthsFor(hull);
  const drive = DRIVES[p.ship.drive] || DRIVES.methalox;

  if (screen === "drive") return <DriveScreen game={game} back={back} actions={actions} />;
  if (screen === "modules") return <ModulesScreen game={game} back={back} actions={actions} />;
  if (screen === "crew") return <CrewScreen game={game} back={back} actions={actions} />;
  if (screen === "ships") return <ShipsScreen game={game} back={back} actions={actions} />;

  return (
    <Screen title="Ship Yard" hint={`${techOf(site).name} yard · trade-in on your ${hull.name}: ${money(tradeInValue(p.ship))}`}>
      <StatStrip items={[
        { label: "Hull", value: `${p.ship.hullPct ?? 100}%`, tone: dmg > 0 ? "hot" : "ok" },
        // "Cargo", matching the header. Two words for one number taught the
        // player there were two numbers.
        { label: "Cargo", value: `${fittedStats(p.ship.hull, p.ship.modules).cargoTonnes} t` },
        { label: "Bays", value: `${slots.usedSlots}/${slots.totalSlots}` },
        { label: "Berths", value: `${p.crew?.length || 0}/${berths}` },
      ]} />

      {dmg > 0
        ? <NavButton icon="🔧" label="Repair the hull" onClick={actions.repair}
            note={`${dmg} points of damage`} value={money(repairCost(game))} tone="hot" />
        : <NavButton icon="🔧" label="Hull is sound" disabled note="Nothing to repair" value="100%" tone="ok" />}
      <NavButton icon="🚀" label="Drive" onClick={() => go("drive")}
        note={drive.boilOffPerDay ? "Runs on hydrogen, and it boils" : "Storable — it keeps in the tank"}
        value={drive.name} />
      <NavButton icon="🔩" label="Modules" onClick={() => go("modules")}
        note={`⚡${slots.total.weapon} 🛡${slots.total.shield} 🔩${slots.total.gadget} bays on this hull`}
        value={`${slots.usedSlots}/${slots.totalSlots} used`} />
      <NavButton icon="👥" label="Crew" onClick={() => go("crew")}
        note={berths === 0 ? "This hull has no spare berth" : "The best hand aboard does the job"}
        value={dailyWages(p) ? `${money(dailyWages(p))}/day` : `${p.crew?.length || 0}/${berths}`}
        tone={dailyWages(p) ? "hot" : undefined} />
      <NavButton icon="🛥" label="Ships for sale" onClick={() => go("ships")}
        note={`${techOf(site).name} yard`} value={money(tradeInValue(p.ship))} tone="gold" />
      {!p.ship.escapePod
        ? <NavButton icon="🛟" label="Escape pod" onClick={actions.buyPod}
            note="Lose the ship and survive it. Buy it before you need it." value={money(ESCAPE_POD.price)} tone="gold" />
        : <NavButton icon="🛟" label="Escape pod" disabled note="Aboard. One use." value="fitted" tone="ok" />}
    </Screen>
  );
}

function DriveScreen({ game, back, actions }) {
  const p = game.player;
  const rows = drivesForSale(game);
  const current = DRIVES[p.ship.drive] || DRIVES.methalox;
  const stats = fittedStats(p.ship.hull, p.ship.modules);
  const yearKept = tankAfter(1, current, 365, stats?.cryo ? CRYO_FACTOR : 1);
  return (
    <Screen title="Drive" onBack={back}
      hint={`${current.name} · trade-in ${money(driveTradeIn(p.ship.drive))}`}>
      {rows.filter(({ drive: d, owned }) => d.forSale || owned).map(({ drive: d, owned, net, canBuy, reason }) => (
        <InfoRow key={d.id} info={reason || d.note} selected={owned} disabled={!d.forSale && !owned}>
          <RowMain
            name={d.name}
            tags={<>
              {owned && <Tag tone="gold">fitted</Tag>}
              {d.speculative && <Tag tone="hot">speculative</Tag>}
              {d.boilOffPerDay > 0 && <Tag>boils off</Tag>}
            </>}
            sub={`${d.isp} s exhaust · ${d.trajectory}${d.forSale && !owned ? ` · needs a ${TECH_LEVELS[d.minTech]?.name.toLowerCase()} yard` : ""}`}
          />
          {owned ? <RowValue top="—" />
            : <button style={{ ...ST.buy, opacity: canBuy ? 1 : 0.4 }} disabled={!canBuy}
                onClick={() => actions.buyDrive(d.id)}>{net >= 0 ? money(net) : `+${money(-net)}`}</button>}
        </InfoRow>
      ))}
      <Footnote>
        A refit is the only purchase that changes what the map <i>means</i> — the rocket equation
        charges exponentially, and an era doubles the base you are exponentiating against.
        {current.boilOffPerDay > 0 && <> A year of coasting leaves <b>{Math.round(yearKept * 100)}%</b> of
          whatever is still in the tank.</>}
      </Footnote>
      {/* The ion drive and the fusion torch are no longer listed — nobody sells
          them, and an unbuyable row is not a choice. The reasons are worth
          keeping, because they are two different kinds of "no". */}
      <Footnote>
        Two more eras exist and neither is for sale. An <b>ion drive</b> is real and flown, but its
        whole payoff is that it spirals instead of burning, so launch windows stop mattering — and
        this game's travel model has no windows yet for it to make irrelevant. A <b>fusion torch</b>
        nobody sells because nobody can build one: 1 g across 1 AU costs about 2,400 km/s, which
        demands a mass ratio near 5×10¹⁰. That is not an engineering gap, it is a wall.
      </Footnote>
    </Screen>
  );
}

function ModulesScreen({ game, back, actions }) {
  const p = game.player;
  const slots = slotUsage(p.ship.hull, p.ship.modules);
  const mods = modulesForSale(game);
  return (
    <Screen title="Modules" onBack={back}
      hint={`⚡ ${slots.used.weapon}/${slots.total.weapon} weapon · 🛡 ${slots.used.shield}/${slots.total.shield} shield · 🔩 ${slots.used.gadget}/${slots.total.gadget} gadget`}>
      {p.ship.modules.map((id) => {
        const m = MODULE_BY_ID[id];
        return (
          <InfoRow key={id} info={m.note} selected>
            <RowMain name={`${m.emoji} ${m.name}`} tags={<Tag tone="gold">fitted</Tag>} sub={`${m.slot} bay`} />
            <button style={ST.quiet} onClick={() => actions.remove(id)}>Remove</button>
          </InfoRow>
        );
      })}
      {/* A module whose bay this hull does not HAVE is not a choice — the Courier
          can never mount a shield. One whose bay is merely full still shows,
          because removing something is a decision you can make. */}
      {mods.filter((m) => !m.fitted && slots.total[m.module.slot] > 0)
        .map(({ module: m, canFit, slotsFree, slotKind }) => (
        <InfoRow key={m.id} info={m.note} disabled={slotsFree <= 0}>
          <RowMain name={`${m.emoji} ${m.name}`} sub={`${slotKind.name.toLowerCase()} bay · ${money(m.price)}`} />
          <button style={{ ...ST.buy, opacity: canFit ? 1 : 0.4 }} disabled={!canFit}
            onClick={() => actions.fit(m.id)}>{slotsFree <= 0 ? "Bay full" : "Fit"}</button>
        </InfoRow>
        ))}
      <Footnote>Every module adds dry mass, so a fully fitted ship costs more Δv to move. The trade never goes away.</Footnote>
    </Screen>
  );
}

function CrewScreen({ game, back, actions }) {
  const p = game.player;
  const hull = HULL_BY_ID[p.ship.hull];
  const berths = berthsFor(hull);
  const eff = effectiveSkills(p);
  const forHire = crewForHire(game.seed, siteOf(game, p.at), game.t);
  return (
    <Screen title="Crew" onBack={back}
      hint={berths === 0
        ? `A ${hull.name} has one berth and you are in it — a bigger hull is the only way to carry anyone`
        : `${p.crew?.length || 0} of ${berths} berths · ${money(dailyWages(p))} a day`}>
      {berths > 0 && (
        <StatStrip items={SKILLS.map((s) => ({
          label: s.name, value: `${eff[s.id]}${eff[`${s.id}By`] ? "*" : ""}`,
          tone: eff[`${s.id}By`] ? "gold" : undefined,
          hint: eff[`${s.id}By`] ? `${eff[`${s.id}By`]} does this, not you` : "Your own rating",
        }))} />
      )}
      {(p.crew || []).map((id) => {
        const c = CREW_BY_ID[id];
        return (
          <InfoRow key={id} info={c.blurb} selected>
            <RowMain name={c.name} tags={<Tag tone="gold">{c.skill} {c.rating}</Tag>} sub={`${money(c.wage)} a day`} />
            <button style={ST.quiet} onClick={() => actions.dismiss(id)}>Pay off</button>
          </InfoRow>
        );
      })}
      {berths > 0 && forHire.filter((c) => !(p.crew || []).includes(c.id)).map((c) => (
        <InfoRow key={c.id} info={c.blurb}>
          <RowMain name={c.name} tags={<Tag>{c.skill} {c.rating}</Tag>} sub={`${money(c.wage)} a day`} />
          <button style={{ ...ST.buy, opacity: berthsFree(p) > 0 ? 1 : 0.4 }} disabled={berthsFree(p) <= 0}
            onClick={() => actions.hire(c.id)}>{berthsFree(p) > 0 ? "Sign on" : "No berth"}</button>
        </InfoRow>
      ))}
      <Footnote>
        The best hand aboard does the job, so a hire can cover a weakness your captain will never fix —
        and they are paid every day, whether the ship is earning or not.
      </Footnote>
    </Screen>
  );
}

function ShipsScreen({ game, back, actions }) {
  const p = game.player;
  const ships = shipsForSale(game, p.at);
  return (
    <Screen title="Ships for sale" onBack={back}
      hint={`${techOf(siteOf(game, p.at)).name} yard · trade-in ${money(tradeInValue(p.ship))}`}>
      {ships.map(({ hull: h, owned, net, affordable, cargoFits, crewFits, berths: b }) => (
        <InfoRow key={h.id} info={h.note} selected={owned}>
          <RowMain name={`${h.emoji} ${h.name}`} tags={owned ? <Tag tone="gold">current</Tag> : null}
            sub={`hold ${h.cargoTonnes} t · tank ${h.fuelTonnes} t · ${b} berth${b === 1 ? "" : "s"} · ⚡${h.slots.weapon} 🛡${h.slots.shield} 🔩${h.slots.gadget}`} />
          {owned ? <RowValue top="—" />
            : <button style={{ ...ST.buy, opacity: affordable && cargoFits && crewFits ? 1 : 0.4 }}
                disabled={!affordable || !cargoFits || !crewFits} onClick={() => actions.buyShip(h.id)}
                title={!cargoFits ? "Your cargo will not fit" : !crewFits ? "Not enough berths for your crew" : ""}>
                {net >= 0 ? money(net) : `+${money(-net)}`}
              </button>}
        </InfoRow>
      ))}
      <Footnote>A used hull never fetches full price, so trading up is a commitment rather than a swap.</Footnote>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// COURSE
// ---------------------------------------------------------------------------

function Course({ game, dest, setDest, actions }) {
  const [showFar, setShowFar] = useState(false);
  const list = destinations(game).filter((d) => d.cost)
    .sort((a, b) => a.cost.days - b.cost.days);
  const chosen = dest && list.find((d) => d.site.id === dest);
  if (chosen) return <DestinationScreen game={game} entry={chosen} back={() => setDest(null)} actions={actions} />;

  // THE LIST SPLITS WHERE THE ROCKET EQUATION SPLITS IT. Eighteen ports in one
  // column is the scroll Joshua was complaining about, and ten of them are walls
  // rather than choices — the tank could not hold the propellant even full. So
  // the ones you can actually fly to come first, and the rest are one click away
  // with the reason attached, which is where they teach something anyway.
  const near = list.filter((d) => d.cost.reachable);
  const far = list.filter((d) => !d.cost.reachable);

  const row = ({ site, cost }) => {
    const rep = repAt(game, site.id);
    const ok = cost.reachable && cost.enoughFuel;
    return (
      <InfoRow key={site.id} info={cost.reachable ? site.why : cost.reason}
        onActivate={cost.reachable ? () => setDest(site.id) : undefined} disabled={!cost.reachable}>
        <RowMain name={site.name}
          tags={<>
            {cost.reachable && !cost.enoughFuel && <Tag tone="hot">refuel first</Tag>}
            {rep && <Tag tone={rep.standing >= 15 ? "ok" : rep.standing <= -30 ? "hot" : undefined}>{rep.tier.name}</Tag>}
          </>}
          sub={`${SYSTEM_BY_ID[site.system]?.name}${dailyCost(game) > 0 && cost.reachable ? ` · ${money(tripCost(game, cost.days))} wages` : ""}`} />
        <RowValue top={`${cost.fuelTonnes.toFixed(0)} t`} bottom={fmtDur(cost.days)} tone={ok ? "ok" : "hot"} />
      </InfoRow>
    );
  };

  if (showFar) {
    return (
      <Screen title="Out of range" onBack={() => setShowFar(false)}
        hint="The tank could not hold the propellant even full. This is the rocket equation, not your bank balance.">
        {far.map(row)}
        <Footnote>A bigger tank, a lighter hold, a depot on the way, or a better drive. Those are the four answers.</Footnote>
      </Screen>
    );
  }

  return (
    <Screen title="Where to?" hint="Cost is propellant and months. Pick one to price the trip.">
      {near.map(row)}
      {far.length > 0 && (
        <NavButton icon="⛔" label="Out of range" onClick={() => setShowFar(true)}
          note="Beyond what this ship can carry propellant for" value={`${far.length} port${far.length === 1 ? "" : "s"}`} tone="hot" />
      )}
    </Screen>
  );
}

function DestinationScreen({ game, entry, back, actions }) {
  const { site, cost } = entry;
  const gov = govOf(site);
  const owed = controlledCargo(game.player, gov);
  const banned = illegalCargo(game.player, gov);
  const carrying = cargoUsed(game.player) > 0;
  const shipping = cost.fuelTonnes && carrying
    ? (cost.fuelTonnes * (fuelPrice(game) || 1200)) / Math.max(1, cargoUsed(game.player)) : 0;
  const { rows, freshness } = runPlan(game, site.id, shipping);
  const cargo = carrying ? cargoValueAt(game, site.id) : null;
  const best = rows.filter((r) => r.viable).slice(0, 3);
  const ok = cost.reachable && cost.enoughFuel;
  const freshTone = { live: "ok", recent: "ok", delayed: "gold", stale: "hot", occluded: "hot" }[freshness?.key];

  return (
    <Screen title={site.name} onBack={back} hint={SYSTEM_BY_ID[site.system]?.name}>
      <StatStrip items={[
        { label: "Propellant", value: `${cost.fuelTonnes.toFixed(1)} t`, tone: ok ? undefined : "hot" },
        { label: "Flight time", value: fmtDur(cost.days) },
        { label: "Wages", value: dailyCost(game) ? money(tripCost(game, cost.days)) : "—" },
        { label: "Intel", value: freshness?.label, tone: freshTone },
      ]} />

      {!cost.reachable && <Footnote><b style={{ color: "var(--hot)" }}>{cost.reason}</b></Footnote>}

      {banned.any && (
        <InfoRow info={`Caught, you lose the cargo and about ${money(banned.fine)} — and it goes on your record. That is the trade: this is also where it is worth most.`}>
          <RowMain name="Contraband aboard" tags={<Tag tone="hot">illegal here</Tag>}
            sub={banned.lines.map((l) => `${l.tonnes} t ${l.name.toLowerCase()}`).join(", ")} />
          <RowValue top={money(banned.fine)} tone="hot" />
        </InfoRow>
      )}
      {owed.any && (
        <InfoRow info={`${gov.type} polices controlled cargo. Declared at inspection this is a legal bill, not a crime — it never touches your record.`}>
          <RowMain name="Customs duty" sub={owed.lines.map((l) => `${l.tonnes} t ${l.name.toLowerCase()}`).join(", ")} />
          <RowValue top={money(owed.duty)} tone="gold" />
        </InfoRow>
      )}

      {freshness?.key === "occluded" ? (
        <Footnote>☀ <b style={{ color: "var(--hot)" }}>Solar conjunction.</b> {freshness.note}</Footnote>
      ) : (
        <>
          {carrying && cargo && (
            <InfoRow info="An estimate from the structural price this port pays, not today's number — you only see that on arrival.">
              <RowMain name="Your cargo would fetch" sub={`${cargo.lines.length} line${cargo.lines.length === 1 ? "" : "s"} aboard`} />
              <RowValue top={`~${money(cargo.total)}`} tone="gold" />
            </InfoRow>
          )}
          {best.length ? best.map((r) => (
            <InfoRow key={r.id} info={`Estimated margin after the propellant this trip costs. ${COMMODITY_BY_ID[r.id]?.note || ""}`}>
              <RowMain name={r.name} sub="worth carrying there" />
              <RowValue top={`+${money(r.marginPerTonne)}/t`} tone="gold" />
            </InfoRow>
          )) : <Footnote>Nothing here pays for the trip. Try a nearer port, or a fuller hold.</Footnote>}
        </>
      )}

      {cost.reachable && (
        <PrimaryButton disabled={!ok} onClick={() => actions.launch(site.id)}>
          {ok ? `Launch — burn ${cost.fuelTonnes.toFixed(1)} t` : "Not enough propellant aboard"}
        </PrimaryButton>
      )}
      <Footnote>{freshness?.note}</Footnote>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// STANDING
// ---------------------------------------------------------------------------

function Standing({ game, screen, go, back }) {
  const track = reputationTrack(game);
  const one = screen && track.find((r) => r.factionId === screen);
  if (one) return <FactionScreen game={game} row={one} back={back} />;
  return (
    <Screen title="Standing" hint="Who is out here this run, and what they make of you.">
      {track.map((r) => (
        <InfoRow key={r.factionId} info={r.tier.note} onActivate={() => go(r.factionId)}>
          <RowMain name={r.faction.name}
            tags={r.atTheirPort ? <Tag tone="gold">you are here</Tag> : null}
            sub={`${r.archetype?.name} · ${r.siteName}`} />
          <RowValue top={r.tier.name} bottom={`${r.standing > 0 ? "+" : ""}${r.standing}`}
            tone={r.standing >= 15 ? "ok" : r.standing <= -30 ? "hot" : undefined} />
        </InfoRow>
      ))}
      <Footnote>
        Standing starts where a faction's disposition puts it, not at zero, and moves when you meet
        them between worlds.
      </Footnote>
    </Screen>
  );
}

function FactionScreen({ game, row, back }) {
  const ledger = repLedger(game, { factionId: row.factionId, limit: 12 });
  const span = REP_MAX - REP_MIN;
  const f = Math.max(0, Math.min(1, (row.standing - REP_MIN) / span));
  const left = Math.min(f, 0.5), right = Math.max(f, 0.5);
  return (
    <Screen title={row.faction.name} onBack={back} hint={`${row.archetype?.name} · holds ${row.siteName}`}>
      <StatStrip items={[
        { label: "Standing", value: `${row.standing > 0 ? "+" : ""}${row.standing}`, tone: row.standing >= 15 ? "ok" : row.standing <= -30 ? "hot" : undefined },
        { label: "Reads as", value: row.tier.name },
        { label: "Talking them round", value: `${row.talkBonusPct > 0 ? "+" : ""}${row.talkBonusPct} pts`, tone: row.talkBonusPct > 0 ? "ok" : row.talkBonusPct < 0 ? "hot" : undefined },
      ]} />
      <div style={ST.track} role="img" aria-label={`${row.faction.name}, ${row.standing} out of 100`}>
        <div style={{ ...ST.fill, left: `${left * 100}%`, width: `${(right - left) * 100}%`, background: row.tier.tone }} />
        <div style={ST.zero} />
      </div>
      <Footnote>{row.tier.note}</Footnote>
      <Footnote>{row.faction.blurb}</Footnote>
      {ledger.length > 0 && <div style={ST.section}>What it took</div>}
      {ledger.map((e, i) => (
        <InfoRow key={i} info={e.reason}>
          <RowMain name={fmtDate(e.t)} sub={e.reason.length > 40 ? `${e.reason.slice(0, 38)}…` : e.reason} />
          <RowValue top={`${e.delta > 0 ? "+" : ""}${e.delta}`} bottom={`→ ${e.standing > 0 ? "+" : ""}${e.standing}`}
            tone={e.delta > 0 ? "ok" : "hot"} />
        </InfoRow>
      ))}
      {ledger.length === 0 && (
        <Footnote>
          You have not met them out there. This number is where their disposition toward a stranger
          started, and nothing has moved it.
        </Footnote>
      )}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// THE ATLAS, attached to the map
// ---------------------------------------------------------------------------

/**
 * What is really in the system you just clicked on.
 *
 * This is the old Atlas tab, moved. It appears beside the system view rather
 * than in a menu of its own, so the place you are reading about is the place you
 * are looking at — and the fifth tab of text is gone from the panel entirely.
 */
export function SystemAtlas({ game, systemId, onBack }) {
  const group = atlasFor(game).find((g) => g.system.id === systemId);
  const { known, total } = atlasProgress(game);
  const hasLab = fittedStats(game.player.ship.hull, game.player.ship.modules).canSurvey;
  if (!group) return null;
  const charted = group.places.filter((x) => x.revealed).length;
  return (
    <Screen title={group.system.name} onBack={onBack}
      hint={`${charted} of ${group.places.length} places charted here · ${known}/${total} in all`}>
      {group.places.map(({ place, revealed, feature, site, visited }) => (
        <InfoRow key={place.id}
          info={revealed ? place.why
            : "Dock here, or arrive anywhere in this system with a survey lab fitted, to chart it."}
          disabled={!revealed}>
          <RowMain name={revealed ? place.name : "???"}
            tags={<>
              {visited && <Tag tone="ok">visited</Tag>}
              {group.surveyed && !visited && <Tag>surveyed</Tag>}
            </>}
            sub={revealed
              ? (feature ? "landmark — nobody can build here" : site ? site.name : "unoccupied")
              : (feature ? "landmark — survey to chart" : "unsurveyed")} />
        </InfoRow>
      ))}
      <Footnote>
        Every entry is a real place and every reason is a real reason. Docking charts one;
        arriving anywhere in a system with a <b>survey lab</b> charts all of
        it{hasLab ? " — yours is aboard." : ", and you do not carry one."}
      </Footnote>
    </Screen>
  );
}

// ---------------------------------------------------------------------------

const ST = {
  trade: { margin: "2px 0 6px", padding: "10px 12px", background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 9 },
  tradeRow: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" },
  stepper: { display: "flex", gap: 5, alignItems: "center" },
  step: { background: "var(--panel)", borderWidth: "1px", borderStyle: "solid", borderColor: "var(--line)", borderRadius: 7, padding: "4px 9px", cursor: "pointer", fontSize: 12.5, minWidth: 30, color: "var(--text)" },
  qty: { minWidth: 42, textAlign: "center", fontWeight: 700, fontVariantNumeric: "tabular-nums", fontSize: 13 },
  buy: { background: "var(--gold)", color: "#1A1200", border: "none", borderRadius: 7, padding: "6px 13px", cursor: "pointer", fontWeight: 700, fontSize: 12.5, flexShrink: 0, fontVariantNumeric: "tabular-nums" },
  sell: { background: "var(--panel)", color: "var(--text)", borderWidth: "1px", borderStyle: "solid", borderColor: "var(--line)", borderRadius: 7, padding: "6px 13px", cursor: "pointer", fontSize: 12.5 },
  quiet: { background: "var(--panel)", borderWidth: "1px", borderStyle: "solid", borderColor: "var(--line)", borderRadius: 7, padding: "5px 11px", cursor: "pointer", fontSize: 12, color: "var(--text)", flexShrink: 0 },
  headline: { fontSize: 12.5, lineHeight: 1.5, padding: "5px 0", color: "#DCE3F0" },
  section: { fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", padding: "10px 0 2px" },
  track: { position: "relative", height: 8, background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 5, overflow: "hidden" },
  fill: { position: "absolute", top: 0, bottom: 0, minWidth: 2 },
  zero: { position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--line)" },
};
