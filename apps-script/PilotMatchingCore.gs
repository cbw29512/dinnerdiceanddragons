function pilotActive_(value) {
  try {
    if (value === true || value === 1) return true;
    const text = String(value || "").toLowerCase();
    return text === "true" || text === "1" || text === "active" || text === "yes";
  } catch (error) {
    console.error("[DDD] pilotActive_ failed", error);
    return false;
  }
}

function pilotCoversSession_(rule, day, startMinutes, endMinutes) {
  try {
    if (!pilotActive_(rule.active)) return false;
    if (String(rule.day_of_week) !== String(day)) return false;
    const ruleStart = pilotMinutes_(rule.start_time);
    const ruleEnd = pilotMinutes_(rule.end_time);
    return Number.isFinite(ruleStart) && Number.isFinite(ruleEnd) && ruleStart <= startMinutes && ruleEnd >= endMinutes;
  } catch (error) {
    console.error("[DDD] pilotCoversSession_ failed", error);
    return false;
  }
}

function pilotHardFit_(playerCount, maxPeoplePerTable, minimumPlayers, maximumPlayers) {
  try {
    const venuePlayerCapacity = Math.max(0, Number(maxPeoplePerTable || 0) - 1);
    const desiredMaximum = Math.max(Number(minimumPlayers || 3), Number(maximumPlayers || 5));
    const usablePlayers = Math.min(Number(playerCount || 0), venuePlayerCapacity, desiredMaximum);
    const minimum = Math.max(1, Number(minimumPlayers || 3));
    return {
      playerCapacity: venuePlayerCapacity,
      usablePlayers,
      viable: venuePlayerCapacity >= minimum && usablePlayers >= minimum,
      needsPlayers: Math.max(0, minimum - usablePlayers)
    };
  } catch (error) {
    console.error("[DDD] pilotHardFit_ failed", error);
    return { playerCapacity:0, usablePlayers:0, viable:false, needsPlayers:Number(minimumPlayers || 3) };
  }
}

function pilotScoreMatch_(usablePlayers, gmDistance, gmRadius, maxPeoplePerTable, targetPlayers) {
  try {
    const target = Math.max(1, Number(targetPlayers || 5));
    const demand = Math.min(40, Math.round((Number(usablePlayers || 0) / target) * 40));
    const distance = Math.max(5, Math.round(25 * (1 - (Number(gmDistance || 0) / Math.max(Number(gmRadius || 1), 1)))));
    const schedule = 25;
    const capacity = Number(maxPeoplePerTable || 0) >= Number(usablePlayers || 0) + 1 ? 10 : 0;
    return { total:Math.min(100, demand + distance + schedule + capacity), demand, distance, schedule, capacity };
  } catch (error) {
    console.error("[DDD] pilotScoreMatch_ failed", error);
    return { total:0, demand:0, distance:0, schedule:0, capacity:0 };
  }
}

function pilotMatchExplanations_(match) {
  try {
    return [
      { criterion:"system", result:"pass", summary:`Active Player demand matches ${match.system}.` },
      { criterion:"schedule", result:"pass", summary:"Venue and counted Players cover the full proposed session." },
      { criterion:"distance", result:"pass", summary:`Venue is ${match.distance.toFixed(1)} miles from the GM and counted Players are inside their own travel limits.` },
      { criterion:"venue_capacity", result:match.hardFit.viable ? "pass" : "emerging", summary:`Venue can seat the GM plus ${match.hardFit.playerCapacity} Players; ${match.hardFit.usablePlayers} compatible Players fit the current table.` },
      { criterion:"commitment", result:"not_evaluated", summary:"Demand indicates compatibility, not a confirmed seat commitment." }
    ];
  } catch (error) {
    console.error("[DDD] pilotMatchExplanations_ failed", error);
    return [];
  }
}
