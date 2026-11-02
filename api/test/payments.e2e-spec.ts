import { minorUnits, newLicenceCode } from '../src/payments/payments.service';

describe('payments helpers', () => {
  it('reads prices in the smallest unit', () => {
    expect(minorUnits('$4.99')).toBe(499);
    expect(minorUnits('399')).toBe(39900);
    expect(minorUnits('₹1,299.50')).toBe(129950);
    expect(minorUnits('free')).toBeNull();
    expect(minorUnits('')).toBeNull();
  });

  it('makes licence codes like ADA-XXXX-XXXX-XXXX', () => {
    expect(newLicenceCode()).toMatch(/^ADA-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });
});
