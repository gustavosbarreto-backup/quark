import Selector from "../Selector";
import { expect } from "@circle/core-assert";

describe("SelectorTest", function() {
    it("uses a selector stream", function(done) {
        expect(Selector.of("test/test/test"))
            .to.exactly.produce("test", { test: "test" }, undefined) // eslint-disable-line
            .on({
                test: {
                    test: {
                        test: "test"
                    }
                }
            }, {
                test: {
                    test: {
                        test: "test"
                    }
                }
            }, {
                test: {
                    test: {
                        test: {
                            test: "test"
                        }
                    }
                }
            }, {})
            .notify(done);
    });
});