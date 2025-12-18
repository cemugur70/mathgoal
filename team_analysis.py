"""
Team Head-to-Head Analysis Module
Calculates and displays statistics for matches between two teams
"""

def get_unique_teams(results: list) -> list:
    """Extract all unique team names from scraped results"""
    teams = set()
    for match in results:
        if 'EV SAHİBİ' in match and match['EV SAHİBİ']:
            teams.add(match['EV SAHİBİ'])
        if 'DEPLASMAN' in match and match['DEPLASMAN']:
            teams.add(match['DEPLASMAN'])
    return sorted(list(teams))


def filter_h2h_matches(results: list, team1: str, team2: str) -> list:
    """Filter matches where team1 and team2 played against each other"""
    h2h_matches = []
    for match in results:
        home = match.get('EV SAHİBİ', '')
        away = match.get('DEPLASMAN', '')
        
        # Match between team1 and team2 (in either order)
        if (home == team1 and away == team2) or (home == team2 and away == team1):
            h2h_matches.append(match)
    
    return h2h_matches


def calculate_h2h_stats(matches: list, team1: str, team2: str) -> dict:
    """Calculate head-to-head statistics between two teams"""
    
    stats = {
        'total_matches': len(matches),
        'team1': team1,
        'team2': team2,
        'team1_wins': 0,
        'team2_wins': 0,
        'draws': 0,
        'team1_home_wins': 0,
        'team1_home_draws': 0,
        'team1_home_losses': 0,
        'team2_home_wins': 0,
        'team2_home_draws': 0,
        'team2_home_losses': 0,
        'team1_goals': 0,
        'team2_goals': 0,
        'team1_ht_leads': 0,
        'team2_ht_leads': 0,
        'ht_draws': 0,
        'over_25': 0,
        'btts_yes': 0,
    }
    
    if not matches:
        return stats
    
    for match in matches:
        home = match.get('EV SAHİBİ', '')
        away = match.get('DEPLASMAN', '')
        ms = match.get('MS', '')
        iy = match.get('İY', '')
        ms_sonucu = match.get('MS SONUCU', '')
        iy_sonucu = match.get('İY SONUCU', '')
        alt_ust = match.get('2.5 ALT ÜST', '')
        kg = match.get('KG VAR/YOK', '')
        
        # Parse score
        try:
            if '-' in ms:
                home_goals, away_goals = [int(x) for x in ms.split('-')]
            else:
                continue
        except:
            continue
        
        # Determine which team is home
        team1_is_home = (home == team1)
        
        # Goals
        if team1_is_home:
            stats['team1_goals'] += home_goals
            stats['team2_goals'] += away_goals
        else:
            stats['team1_goals'] += away_goals
            stats['team2_goals'] += home_goals
        
        # Match result
        if team1_is_home:
            if home_goals > away_goals:
                stats['team1_wins'] += 1
                stats['team1_home_wins'] += 1
            elif home_goals < away_goals:
                stats['team2_wins'] += 1
                stats['team1_home_losses'] += 1
            else:
                stats['draws'] += 1
                stats['team1_home_draws'] += 1
        else:  # team2 is home
            if home_goals > away_goals:
                stats['team2_wins'] += 1
                stats['team2_home_wins'] += 1
            elif home_goals < away_goals:
                stats['team1_wins'] += 1
                stats['team2_home_losses'] += 1
            else:
                stats['draws'] += 1
                stats['team2_home_draws'] += 1
        
        # Half-time result
        if iy and '-' in iy:
            try:
                ht_home, ht_away = [int(x) for x in iy.split('-')]
                if team1_is_home:
                    if ht_home > ht_away:
                        stats['team1_ht_leads'] += 1
                    elif ht_home < ht_away:
                        stats['team2_ht_leads'] += 1
                    else:
                        stats['ht_draws'] += 1
                else:
                    if ht_home > ht_away:
                        stats['team2_ht_leads'] += 1
                    elif ht_home < ht_away:
                        stats['team1_ht_leads'] += 1
                    else:
                        stats['ht_draws'] += 1
            except:
                pass
        
        # Over/Under
        if 'ÜST' in alt_ust:
            stats['over_25'] += 1
        
        # BTTS
        if 'VAR' in kg:
            stats['btts_yes'] += 1
    
    return stats


def format_h2h_report(stats: dict) -> str:
    """Format statistics into a readable report"""
    
    if stats['total_matches'] == 0:
        return f"❌ {stats['team1']} vs {stats['team2']} arasında maç bulunamadı!"
    
    total = stats['total_matches']
    t1 = stats['team1']
    t2 = stats['team2']
    
    report = f"""
{'═' * 50}
🏆 {t1} vs {t2}
{'═' * 50}

📊 TOPLAM: {total} maç

🏆 KAZANANLAR:
├── {t1}: {stats['team1_wins']} ({100*stats['team1_wins']//total}%)
├── Berabere: {stats['draws']} ({100*stats['draws']//total}%)
└── {t2}: {stats['team2_wins']} ({100*stats['team2_wins']//total}%)

⚽ İLK YARI SONUÇLARI:
├── {t1} Önde: {stats['team1_ht_leads']}
├── Berabere: {stats['ht_draws']}
└── {t2} Önde: {stats['team2_ht_leads']}

🏠 EV SAHİBİ PERFORMANSI:
├── {t1} (Ev): {stats['team1_home_wins']}G-{stats['team1_home_draws']}B-{stats['team1_home_losses']}M
└── {t2} (Ev): {stats['team2_home_wins']}G-{stats['team2_home_draws']}B-{stats['team2_home_losses']}M

📈 GOL İSTATİSTİKLERİ:
├── {t1} Attı: {stats['team1_goals']} ({stats['team1_goals']/total:.1f} ort.)
├── {t2} Attı: {stats['team2_goals']} ({stats['team2_goals']/total:.1f} ort.)
├── 2.5 ÜST: {stats['over_25']} maç ({100*stats['over_25']//total}%)
└── KG VAR: {stats['btts_yes']} maç ({100*stats['btts_yes']//total}%)

{'═' * 50}
"""
    return report


def get_team_last_matches(results: list, team: str, limit: int = 10) -> list:
    """Get last N matches of a specific team, sorted by date (newest first)"""
    team_matches = []
    for match in results:
        home = match.get('EV SAHİBİ', '')
        away = match.get('DEPLASMAN', '')
        
        if home == team or away == team:
            team_matches.append(match)
    
    # Sort by date (newest first) - TARİH format: DD.MM.YYYY
    def parse_date(m):
        try:
            tarih = m.get('TARİH', '01.01.2000')
            parts = tarih.split('.')
            return (int(parts[2]), int(parts[1]), int(parts[0]))  # (year, month, day)
        except:
            return (2000, 1, 1)
    
    team_matches.sort(key=parse_date, reverse=True)
    return team_matches[:limit]


def format_team_report(matches: list, team: str) -> str:
    """Format single team match history into a readable report"""
    
    if not matches:
        return f"❌ {team} takımına ait maç bulunamadı!"
    
    report = f"""
{'═' * 55}
🏆 {team} - SON {len(matches)} MAÇ
{'═' * 55}

"""
    
    wins, draws, losses = 0, 0, 0
    goals_for, goals_against = 0, 0
    home_matches, away_matches = 0, 0
    
    for i, match in enumerate(matches, 1):
        home = match.get('EV SAHİBİ', '')
        away = match.get('DEPLASMAN', '')
        ms = match.get('MS', '0-0')
        tarih = match.get('TARİH', '')
        
        is_home = (home == team)
        opponent = away if is_home else home
        loc = "🏠" if is_home else "✈️"
        
        try:
            h_goals, a_goals = [int(x) for x in ms.split('-')]
            team_goals = h_goals if is_home else a_goals
            opp_goals = a_goals if is_home else h_goals
            
            goals_for += team_goals
            goals_against += opp_goals
            
            if is_home:
                home_matches += 1
            else:
                away_matches += 1
            
            if team_goals > opp_goals:
                result = "✅ G"
                wins += 1
            elif team_goals < opp_goals:
                result = "❌ M"
                losses += 1
            else:
                result = "🟡 B"
                draws += 1
            
            # Show score from team's perspective
            score = f"{team_goals}-{opp_goals}"
            report += f"{i:2}. {loc} {tarih}  vs {opponent:20} {score}  {result}\n"
            
        except:
            report += f"{i:2}. {loc} {tarih}  vs {opponent:20} {ms}  ⚪\n"
    
    total = len(matches)
    report += f"""
{'─' * 55}

📊 ÖZET İSTATİSTİKLER:
├── Galibiyet: {wins} ({100*wins//total}%)
├── Beraberlik: {draws} ({100*draws//total}%)
├── Mağlubiyet: {losses} ({100*losses//total}%)
├── Atılan Gol: {goals_for} ({goals_for/total:.1f} ort.)
├── Yenilen Gol: {goals_against} ({goals_against/total:.1f} ort.)
├── Ev Maçı: {home_matches}
└── Deplasman: {away_matches}

{'═' * 55}
"""
    return report
