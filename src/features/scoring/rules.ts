import type { GameRules } from '../../types';

/**
 * Default rule set. Muushig has regional variants, so every rule below is
 * configurable per game and the chosen values are snapshotted into each game.
 * See README → "Дүрмийн таамаглал" for the reasoning behind each default.
 */
export const DEFAULT_RULES: GameRules = {
  startingPoints: 15,
  pointsPerTrick: 1,
  noTrickPenalty: 5,
  passPenalty: 0,
  tricksPerRound: 5,
  enforceTrickTotal: true,
  booltMultiplier: 2,
  booltAffectsPoints: true,
  booltAffectsMoney: true,
  endCondition: 'first_out',
  targetScore: 0,
  fourSuitInstantWin: false,
  allowManualAdjust: true,
  settlementMode: 'stake',
  pointValue: 1000,
};

export const DEFAULT_STAKE = 5000;

/** Suggested боолт fee: makes a single боолт double the stake. */
export function suggestedBooltAmount(stake: number, multiplier: number): number {
  return Math.max(0, Math.round(stake * (multiplier - 1)));
}

/** Deep-copies a rules object so later edits can never leak into a stored game. */
export function snapshotRules(rules: GameRules): GameRules {
  return JSON.parse(JSON.stringify(rules)) as GameRules;
}

/** Human-readable (Mongolian) description of each rule — shown in the UI. */
export const RULE_DESCRIPTIONS: Record<keyof GameRules, { label: string; help: string }> = {
  startingPoints: { label: 'Эхлэх оноо', help: 'Тоглогч бүр энэ оноотойгоор эхэлнэ.' },
  pointsPerTrick: { label: 'Нэг мөрийн оноо', help: 'Авсан мөр бүрд оноо ийм хэмжээгээр хасагдана.' },
  noTrickPenalty: { label: 'Мөргүй торгууль', help: 'Тоглоод нэг ч мөр аваагүй бол оноо ийм хэмжээгээр нэмэгдэнэ.' },
  passPenalty: { label: 'Сугарсны оноо', help: 'Тухайн тойрогт сугарсан (тоглоогүй) тоглогчид нэмэгдэх оноо.' },
  tricksPerRound: { label: 'Тойрог дахь мөр', help: '5 хөзөр → 5 мөр.' },
  enforceTrickTotal: { label: 'Мөрийн нийлбэр шалгах', help: 'Тоглосон хүмүүсийн мөрийн нийлбэр тойрог дахь мөртэй тэнцүү байхыг шаардана.' },
  booltMultiplier: { label: 'Боолтын үржвэр', help: 'Боолт хийсэн тоглогчийн оноо/бооцоо энэ үржвэрээр өснө.' },
  booltAffectsPoints: { label: 'Боолт оноонд нөлөөлөх', help: 'Боолт хийсэн тоглогчийн тухайн тойргийн оноог үржвэрээр үржүүлнэ.' },
  booltAffectsMoney: { label: 'Боолт мөнгөнд нөлөөлөх', help: 'Хожигдсон тоглогч боолт бүрдээ боолтын дүнг нэмж төлнө.' },
  endCondition: { label: 'Тоглолт дуусах нөхцөл', help: 'Эхэлж гарсан нь хожих эсвэл сүүлд үлдсэн нь хожигдох.' },
  targetScore: { label: 'Гарах оноо', help: 'Энэ оноонд хүрсэн (эсвэл доош орсон) тоглогч гарна.' },
  fourSuitInstantWin: { label: 'Дөрвөн тамга', help: 'Нэг өнгийн дөрвөн хөзөр барьсан тоглогч шууд хожно (идэвхжүүлсэн үед).' },
  allowManualAdjust: { label: 'Гар засвар', help: 'Тойрог бүрт тоглогчийн оноог гараар +/- засахыг зөвшөөрнө.' },
  settlementMode: { label: 'Тооцооны арга', help: 'Гарааны бооцоогоор эсвэл онооны зөрүүгээр тооцно.' },
  pointValue: { label: 'Нэг онооны үнэ', help: 'Онооны зөрүүгээр тооцох үед 1 оноо = ийм ₮.' },
};
