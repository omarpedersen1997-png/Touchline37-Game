const danishInteger=new Intl.NumberFormat('da-DK',{maximumFractionDigits:0});
export const moneyNumber=value=>danishInteger.format(Number.isFinite(value)?value:0);
export const moneyLabel=value=>`${moneyNumber(value)} kr.`;
