import assert from "node:assert/strict";
import test from "node:test";
import { fightMultipliers, settleFight } from "../src/settle.js";

test("los multiplicadores usan el pozo neto y se actualizan con las apuestas", () => {
  const bets = [
    { name: "Ana", phone: "111", amount: 1500, side: "a" },
    { name: "Luis", phone: "222", amount: 500, side: "b" },
  ];
  assert.deepEqual(fightMultipliers(bets), { a: 1.2, b: 3.6 });
  for (const side of ["a", "b"]) {
    const payout = settleFight(bets, side).payouts[0];
    assert.equal(payout.amount / payout.stake, fightMultipliers(bets)[side]);
  }
  bets.push({ name: "Sol", phone: "333", amount: 1000, side: "b" });
  assert.deepEqual(fightMultipliers(bets), { a: 1.8, b: 1.8 });
  bets.pop();
  assert.deepEqual(fightMultipliers(bets), { a: 1.2, b: 3.6 });
});

test("sin apuestas no muestra un multiplicador y respeta el redondeo de la casa", () => {
  assert.deepEqual(fightMultipliers([]), { a: null, b: null });
  assert.deepEqual(fightMultipliers([
    { name: "Ana", phone: "111", amount: 111, side: "a" },
  ]), { a: 100 / 111, b: null });
});

test("reparte el 90% en proporción y la casa se queda el 10%", () => {
  const result = settleFight(
    [
      { name: "Ana", phone: "111", amount: 1000, side: "a" },
      { name: "Luis", phone: "222", amount: 500, side: "a" },
      { name: "Pedro", phone: "333", amount: 500, side: "b" },
    ],
    "a",
  );

  assert.deepEqual(result, {
    pool: 2000,
    house: 200,
    payouts: [
      { name: "Ana", phone: "111", stake: 1000, amount: 1200 },
      { name: "Luis", phone: "222", stake: 500, amount: 600 },
    ],
  });
});

test("redondea la casa al peso más cercano y los pagos suman el resto", () => {
  const result = settleFight(
    [
      { name: "Ana", phone: "111", amount: 37, side: "a" },
      { name: "Luis", phone: "222", amount: 37, side: "a" },
      { name: "Sol", phone: "333", amount: 37, side: "a" },
    ],
    "a",
  );

  assert.equal(result.pool, 111);
  assert.equal(result.house, 11);
  assert.deepEqual(
    result.payouts.map((payout) => payout.amount),
    [34, 33, 33],
  );
  assert.equal(
    result.payouts.reduce((sum, payout) => sum + payout.amount, 0),
    result.pool - result.house,
  );
});

test("suma en una línea las apuestas del mismo teléfono", () => {
  const result = settleFight(
    [
      { name: "Ana", phone: "111", amount: 100, side: "a" },
      { name: "Ana P", phone: "111", amount: 50, side: "a" },
      { name: "Luis", phone: "222", amount: 50, side: "a" },
    ],
    "a",
  );

  assert.deepEqual(result.payouts, [
    { name: "Ana", phone: "111", stake: 150, amount: 135 },
    { name: "Luis", phone: "222", stake: 50, amount: 45 },
  ]);
});

test("si nadie apostó al ganador, el pozo entero queda para la casa", () => {
  const result = settleFight(
    [{ name: "Ana", phone: "111", amount: 800, side: "a" }],
    "b",
  );

  assert.deepEqual(result, {
    pool: 800,
    house: 800,
    payouts: [],
  });
});

test("un pozo de cero no reparte nada", () => {
  const result = settleFight([], "a");

  assert.deepEqual(result, {
    pool: 0,
    house: 0,
    payouts: [],
  });
});
