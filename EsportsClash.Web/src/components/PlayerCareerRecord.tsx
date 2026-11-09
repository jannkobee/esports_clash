import {PlayerForm} from './PlayerForm';
import { pediaHref, pediaMoney, pediaTime, type PlayerCareerData } from '../hexapedia';
import { toScale10 } from '../marketBatchEngine';
import { LabelIcon } from './LabelIcon';
import { ratingWord } from '../matchRatingScale';

export function PlayerCareerRecord({ career }: { career?: PlayerCareerData }) {
  if (!career) return <p>Career records are not available for this historical identity.</p>;

  return <div className="career-record">
    <div className="career-grid">
      <section>
        <h3><LabelIcon name="contract"/> Contract record</h3>
        <dl className="club-facts">
          <div><dt>Registry entry</dt><dd>{career.registered_at ? pediaTime(career.registered_at) : 'Not recorded'}</dd></div>
          <div><dt>Current club</dt><dd>{career.current_contract ? <a href={pediaHref('teams', career.current_contract.id)}>{career.current_contract.name}</a> : 'No active contract'}</dd></div>
          {career.retired_at && <div><dt>Retired</dt><dd>{pediaTime(career.retired_at)}</dd></div>}
        </dl>
        {!!career.aliases?.length&&<><h3><LabelIcon name="player"/> Previous IGNs</h3><ol className="career-timeline">{career.aliases.map((alias,i)=><li key={i}><time>{pediaTime(alias.date)} Manila</time><strong>{alias.previous} ? {alias.current}</strong></li>)}</ol></>}
        <h3><LabelIcon name="transfers"/> Settled transfers</h3>
        {career.transfers.length ? <ol className="career-timeline">{career.transfers.map(transfer =>
          <li key={transfer.id}>
            <time>{transfer.date ? `${pediaTime(transfer.date)} Manila` : 'Date not recorded'}</time>
            <a href={pediaHref('teams', transfer.from.id)}>{transfer.from.name}</a> → <a href={pediaHref('teams', transfer.to.id)}>{transfer.to.name}</a>
            <p>{transfer.method === 'Player trade' ? 'Completed player trade · No individual fee assigned' : `${pediaMoney(transfer.fee ?? 0)} · Winning auction bid`}</p>
          </li>)}</ol> : <p className="pedia-muted">No settled auction transfers recorded.</p>}
      </section>
      <section>
        <h3><LabelIcon name="honors"/> Tournament honors</h3>
        {career.honors.length ? <ol className="career-timeline">{career.honors.map(honor =>
          <li key={honor.tournament_id}><strong>{honor.year} champion</strong><p><a href={pediaHref('tournaments', honor.tournament_id)}>{honor.name}</a></p><small>{honor.basis}</small></li>)}</ol>
          : <p className="pedia-muted">No verified winning-final appearances recorded.</p>}
        <h3><LabelIcon name="match history"/> Recent appearances</h3>
        <ol className="career-timeline">{career.appearances.slice(0, 8).map(appearance =>
          <li key={appearance.fixture_id}>
            <time>{pediaTime(appearance.date)} Manila</time>{appearance.competition} · {appearance.won ? 'Win' : 'Loss'}
            <p>{appearance.club.id ? <a href={pediaHref('teams', appearance.club.id)}>{appearance.club.name}</a> : appearance.club.name}</p>
          </li>)}</ol>
        {!career.appearances.length && <p className="pedia-muted">No verified scheduled appearances yet.</p>}
      </section>
    </div>
    <section className="career-ratings">
      <h3><LabelIcon name="form"/> Match ratings &amp; form</h3>
      <PlayerForm form={career.form} detail/>
      <p className="pedia-muted">Recent verified ratings carry more weight. Two neutral prior appearances temper small samples; inactivity reduces the evidence. Form does not modify combat attributes.</p>
      {career.match_ratings.length ? <div className="pedia-table-scroll"><table className="pedia-table">
        <thead><tr><th>Match · Manila</th><th>Club</th><th>Result</th><th>Hex rating</th><th>K / D / A</th><th>CS</th><th>Damage</th></tr></thead>
        <tbody>{career.match_ratings.map(match =>
          <tr key={match.match_id}>
            <td>{pediaTime(match.date)}<br/><small>{match.competition}</small></td>
            <td>{match.club.id ? <a href={pediaHref('teams', match.club.id)}>{match.club.name}</a> : match.club.name}</td>
            <td>{match.won ? 'Win' : 'Loss'}</td>
            <td><strong>{match.rating.toFixed(1)} {ratingWord(match.rating)}</strong><small> / 10</small></td>
            <td>{match.performance.kills ?? '—'} / {match.performance.deaths ?? '—'} / {match.performance.assists ?? '—'}</td>
            <td>{match.performance.cs ?? '—'}</td>
            <td>{Math.round(match.performance.damage ?? 0).toLocaleString()}</td>
          </tr>)}</tbody>
      </table></div> : <p className="pedia-muted">Match ratings will appear after the player completes a recorded Arena match.</p>}
      <p className="pedia-source-note">Hex rating uses a 1–10 scale: 1 Dreadful, 2 Poor, 3 Weak, 4 Mediocre, 5 Average, 6 Passable, 7 Good, 8 Strong, 9 Excellent, 10 Exceptional. Ratings are transparent estimates from verified final Arena stats, team result, participation, deaths, CS, damage, and gold; they are not official competition awards.</p>
    </section>
    <h3><LabelIcon name="development"/> Observed development</h3>
    {career.development.length ? <div className="pedia-table-scroll"><table className="pedia-table">
      <thead><tr><th>Observed · Manila</th><th>Overall</th><th>Training XP</th>{['Laning', 'Teamfighting', 'Game sense', 'Leadership', 'Clutch', 'Stamina', 'Flexibility'].map(label => <th key={label}>{label}</th>)}</tr></thead>
      <tbody>{career.development.map(snapshot =>
        <tr key={snapshot.observed_at}><td>{pediaTime(snapshot.observed_at)}</td><td>{toScale10(snapshot.overall)}/10</td><td>{snapshot.training_xp}</td>{['lan', 'tf', 'iq', 'ldr', 'clu', 'sta', 'flx'].map(key => <td key={key}>{toScale10(snapshot.stats[key] ?? 0)}/10</td>)}</tr>)}</tbody>
    </table></div> : <p className="pedia-muted">Development observations start with the next club report. Earlier values are not reconstructed.</p>}
    <p className="pedia-source-note">{career.note}</p>
  </div>;
}
