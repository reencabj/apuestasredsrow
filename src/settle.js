function distribute(groups, prize) {
  const totalStake = groups.reduce((sum, group) => sum + group.stake, 0);
  const shares = groups.map((group) => {
    const exact = (group.stake / totalStake) * prize;
    return {
      name: group.name,
      phone: group.phone,
      stake: group.stake,
      amount: Math.floor(exact),
      fraction: exact - Math.floor(exact),
    };
  });

  let remainder = prize - shares.reduce((sum, share) => sum + share.amount, 0);
  const order = shares
    .map((share, index) => ({ index, fraction: share.fraction }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);

  let cursor = 0;
  while (remainder > 0) {
    shares[order[cursor % order.length].index].amount += 1;
    remainder -= 1;
    cursor += 1;
  }

  return shares.map(({ name, phone, stake, amount }) => ({
    name,
    phone,
    stake,
    amount,
  }));
}

export function fightMultipliers(bets) {
  const pool = bets.reduce((sum, bet) => sum + bet.amount, 0);
  const prize = pool - Math.round(pool * 0.1);
  return Object.fromEntries(["a", "b"].map((side) => {
    const stake = bets.filter((bet) => bet.side === side)
      .reduce((sum, bet) => sum + bet.amount, 0);
    return [side, stake > 0 ? prize / stake : null];
  }));
}

export function settleFight(bets, winner) {
  const pool = bets.reduce((sum, bet) => sum + bet.amount, 0);
  const winningBets = bets.filter((bet) => bet.side === winner);

  if (winningBets.length === 0) {
    return { pool, house: pool, payouts: [] };
  }

  const house = Math.round(pool * 0.1);
  const groups = [];

  for (const bet of winningBets) {
    const phone = bet.phone.trim();
    let group = groups.find((item) => item.phone === phone);
    if (!group) {
      group = { name: bet.name.trim(), phone, stake: 0 };
      groups.push(group);
    }
    group.stake += bet.amount;
  }

  return {
    pool,
    house,
    payouts: distribute(groups, pool - house),
  };
}
