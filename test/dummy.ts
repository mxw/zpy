import {foo} from "../src/schema";

import {expect} from "chai";

describe('foo', () => {
  it('should be 4', () => {
    expect(foo).to.equal(4);
  });
});
