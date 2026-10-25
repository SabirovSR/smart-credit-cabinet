import Decimal from "decimal.js";
import { policy } from "./policy";
const Money = Decimal.clone({ precision: 40 });
export function calculatePayment(
  amountRub: number,
  termMonths: number,
  annualRateBps: number = policy.annualRateBps,
) {
  if (
    !Number.isSafeInteger(amountRub) ||
    amountRub <= 0 ||
    !Number.isSafeInteger(termMonths) ||
    termMonths <= 0 ||
    !Number.isSafeInteger(annualRateBps) ||
    annualRateBps < 0
  )
    throw new RangeError("Invalid calculation input");
  const rate = new Money(annualRateBps).div(10_000).div(12);
  const payment = rate.isZero()
    ? new Money(amountRub).div(termMonths)
    : new Money(amountRub)
        .mul(rate)
        .div(new Money(1).minus(rate.plus(1).pow(-termMonths)));
  const monthlyPaymentRub = payment.ceil().toNumber();
  const totalRepaymentRub = monthlyPaymentRub * termMonths;
  return {
    amountRub,
    termMonths,
    annualRateBps,
    monthlyPaymentRub,
    totalRepaymentRub,
    interestRub: totalRepaymentRub - amountRub,
    policyVersion: policy.version,
  };
}
export function affordable(cashFlow: number, debt: number, payment: number) {
  return cashFlow * 5 >= (debt + payment) * 6;
}
export function findAffordableAmount(
  requested: number,
  months: number,
  cashFlow: number,
  debt: number,
) {
  let lo = policy.minAmount / policy.amountStep,
    hi = Math.floor(requested / policy.amountStep),
    answer = 0;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (
      affordable(
        cashFlow,
        debt,
        calculatePayment(mid * policy.amountStep, months).monthlyPaymentRub,
      )
    ) {
      answer = mid * policy.amountStep;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return answer;
}
