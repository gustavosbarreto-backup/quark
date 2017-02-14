// @flow

import DeclaredAction from "../DeclaredAction";
import { expect } from "chai";

describe("DeclaredActionTest", function() {
    it("creates a declared action", function() {
        const action = DeclaredAction.triggered.by("blub");

        expect(action.toJS()).to.eql({
            name:     "anonymous",
            triggers: [{
                delay:  0,
                guards: 0,
                name:   "anonymous",
                params: []
            }, {
                delay:  0,
                guards: 0,
                name:   "blub",
                params: []
            }]
        });
    });

    it("adds a name to a declared action", function() {
        const action = DeclaredAction.triggered
            .by("blub")
            .setName("test");

        expect(action.toJS()).to.eql({
            name:     "test",
            triggers: [{
                delay:  0,
                guards: 0,
                name:   "test",
                params: []
            }, {
                delay:  0,
                guards: 0,
                name:   "blub",
                params: []
            }]
        });
    });

    it("has some fun with declared actions", function() {
        const guard0 = x => x > 0;
        const guard1 = x => x > 1;
        const guard2 = x => x < 2;
        const guard3 = x => x < 1;
        const action = DeclaredAction.triggered
            .if(guard0)
            .by("blub")
                .if(guard1)
                .if(guard2)
                .after(10)
            .by("lulu")
                .if(guard3)
                .with("blub", 1)
                .with(0)
            .setName("test");

        expect(action.toJS()).to.eql({
            name:     "test",
            triggers: [{
                delay:  0,
                guards: 1,
                name:   "test",
                params: []
            }, {
                delay:  10,
                guards: 2,
                name:   "blub",
                params: []
            }, {
                delay:  0,
                guards: 1,
                name:   "lulu",
                params: ["blub", 1, 0]
            }]
        });
    });
});