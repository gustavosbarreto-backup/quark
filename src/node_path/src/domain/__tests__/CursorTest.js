import Cursor from "../Cursor";
import { expect } from "chai";
import Immutable from "immutable";
import sinon from "sinon";
import Action from "../Action";
import Internals from "../Internals";
import Message from "../../Message";
import Uuid from "../../util/Uuid";

describe("CursorTest", function() { // eslint-disable-line
    beforeEach(function() {
        let counter = 0;
        let id      = 0;

        this.now  = global.Date.now;
        this.uuid = sinon.stub(Uuid, "uuid", () => ++id);

        global.Date.now = () => ++counter;
    });

    afterEach(function() {
        global.Date.now = this.now;
        this.uuid.restore();
    });

    it("creates a cursor for a unit", function() {
        const func = function(a) {
            return this.get("test").length + 2 + a;
        };
        const action = new Action("Test", "blub", Immutable.List(), func);

        action.func = func;

        const data = Immutable.fromJS({
            _unit: new Internals({
                name:        "Unit",
                description: Immutable.Map({
                    blub: action
                }),
                children: Immutable.Map({
                    test: Immutable.Map()
                })
            }),
            test: "test"
        });
        const UnitCursor = Cursor.for(new (class Unit {})(), data.get("_unit").description);

        expect(UnitCursor.name).to.equal("UnitCursor");
        expect(UnitCursor).to.be.a("function");

        const cursor = new UnitCursor(data);

        expect(cursor).to.be.an.instanceOf(Cursor);
        expect(cursor.toJS()).to.eql({
            _unit: new Internals({
                name:        "Unit",
                description: Immutable.Map({
                    blub: action
                }),
                children: Immutable.Map({
                    test: Immutable.Map()
                })
            }).toJS(),
            test: "test"
        });
        expect(cursor.children.toJS()).to.eql({
            test: {}
        });
        expect(cursor.blub).to.be.a("function");
        expect(cursor.blub(1)).to.equal(7);
    });

    it("checks some methods on a cursor", function() {
        const error    = new Error("huhu");
        const message  = new Message("/test", []);
        const children = Immutable.Map({
            test: Immutable.Map()
        });

        const data    = Immutable.fromJS({
            _unit: new Internals({
                name:        "Unit",
                description: Immutable.Map(),
                action:      message,
                errors:      Immutable.List.of(error),
                children:    children
            })
        });
        const UnitCursor = Cursor.for(new (class Unit {})(), data.get("_unit").description);
        const cursor     = new UnitCursor(data);

        expect(cursor.currentMessage).to.equal(message);
        expect(cursor.set("action", message).currentMessage).to.be.an.instanceOf(Message);
        expect(cursor.errors.toJS()).to.eql([error]);
        expect(cursor.currentError).to.equal(error);
        expect(cursor.currentContext).to.equal("Unit");
        expect(cursor.hasErrored).to.equal(true);
        expect(cursor.children).to.equal(children);
    });

    it("does a trace", function() { // eslint-disable-line
        const message = new Message("/test", [1]);
        const data    = Immutable.fromJS({
            _unit: new Internals({
                name:        "Unit",
                description: Immutable.Map(),
                action:      message
            })
        });
        const UnitCursor = Cursor.for(new (class Unit {})(), data.get("_unit").description);
        const cursor     = new UnitCursor(data);

        expect(() => cursor.trace.end()).to.throw("AssertionError: You have to start a trace with 'Cursor::trace: (string -> { name: string }) -> Cursor', before you can change it's state to 'ended'.");
        expect(() => cursor.trace.triggered()).to.throw("AssertionError: You have to start a trace with 'Cursor::trace: (string -> { name: string }) -> Cursor', before you can change it's state to 'triggered'.");
        expect(() => cursor.trace.error()).to.throw("AssertionError: You have to start a trace with 'Cursor::trace: (string -> { name: string }) -> Cursor', before you can change it's state to 'errored'.");

        expect(() => cursor.trace("/test", Immutable.List.of(false))).to.throw("AssertionError: You can only call 'Cursor::trace' in the context of an arriving message. Please make sure to use this class in conjunction with 'Runtime' or to provide an 'Internals' instance to the constructor of this class, which did receive a message.");

        const cursor2 = cursor
            .update("_unit", internals => internals.set("action", null).messageReceived(message))
            .trace("test", Immutable.List.of(false));

        expect(cursor2.toJS()).to.eql({
            _unit: {
                action:      message.toJS(),
                children:    {},
                current:     0,
                description: {},
                diffs:       [],
                errors:      [],
                history:     [],
                id:          null,
                name:        "Unit",
                revision:    0,
                traces:      [{
                    id:       1,
                    parent:   null,
                    end:      null,
                    error:    null,
                    guards:   0,
                    name:     "Unit::Message</test>",
                    params:   [1],
                    start:    1,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }, {
                    id:       2,
                    parent:   1,
                    end:      null,
                    error:    null,
                    guards:   0,
                    name:     "Unit::test",
                    params:   [false],
                    start:    2,
                    traces:   [],
                    triggers: false,
                    locked:   false,
                    trigger:  null
                }]
            }
        });

        const cursor3 = cursor2.trace.triggered();

        expect(cursor3.toJS()).to.eql({
            _unit: {
                action:      message.toJS(),
                children:    {},
                current:     0,
                description: {},
                diffs:       [],
                errors:      [],
                history:     [],
                id:          null,
                name:        "Unit",
                revision:    0,
                traces:      [{
                    id:       1,
                    parent:   null,
                    end:      null,
                    error:    null,
                    guards:   0,
                    name:     "Unit::Message</test>",
                    params:   [1],
                    start:    1,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }, {
                    id:       2,
                    parent:   1,
                    end:      null,
                    error:    null,
                    guards:   0,
                    name:     "Unit::test",
                    params:   [false],
                    start:    2,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }]
            }
        });

        const cursor4 = cursor3.trace("test2", Immutable.List.of(1));

        expect(cursor4.toJS()).to.eql({
            _unit: {
                action:      message.toJS(),
                children:    {},
                current:     0,
                description: {},
                diffs:       [],
                errors:      [],
                history:     [],
                id:          null,
                name:        "Unit",
                revision:    0,
                traces:      [{
                    id:       1,
                    parent:   null,
                    end:      null,
                    error:    null,
                    guards:   0,
                    name:     "Unit::Message</test>",
                    params:   [1],
                    start:    1,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }, {
                    id:       2,
                    parent:   1,
                    end:      null,
                    error:    null,
                    guards:   0,
                    name:     "Unit::test",
                    params:   [false],
                    start:    2,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }, {
                    id:       3,
                    parent:   2,
                    end:      null,
                    error:    null,
                    guards:   0,
                    name:     "Unit::test2",
                    params:   [1],
                    start:    3,
                    traces:   [],
                    triggers: false,
                    locked:   false,
                    trigger:  null
                }]
            }
        });

        const cursor5 = cursor4.trace.triggered().trace("test3", Immutable.List.of(2));

        expect(cursor5.toJS()).to.eql({
            _unit: {
                action:      message.toJS(),
                children:    {},
                current:     0,
                description: {},
                diffs:       [],
                errors:      [],
                history:     [],
                id:          null,
                name:        "Unit",
                revision:    0,
                traces:      [{
                    id:       1,
                    parent:   null,
                    end:      null,
                    error:    null,
                    guards:   0,
                    name:     "Unit::Message</test>",
                    params:   [1],
                    start:    1,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }, {
                    id:       2,
                    parent:   1,
                    end:      null,
                    error:    null,
                    guards:   0,
                    name:     "Unit::test",
                    params:   [false],
                    start:    2,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }, {
                    id:       3,
                    parent:   2,
                    end:      null,
                    error:    null,
                    guards:   0,
                    name:     "Unit::test2",
                    params:   [1],
                    start:    3,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }, {
                    id:       4,
                    parent:   3,
                    end:      null,
                    error:    null,
                    guards:   0,
                    name:     "Unit::test3",
                    params:   [2],
                    start:    4,
                    traces:   [],
                    triggers: false,
                    locked:   false,
                    trigger:  null
                }]
            }
        });

        const cursor6 = cursor5.trace
            .triggered()
            .trace("test4", Immutable.List.of(3))
            .trace.triggered()
            .trace.error(new Error("hi"));

        expect(cursor6.toJS()).to.eql({
            _unit: {
                action:      message.toJS(),
                children:    {},
                current:     0,
                description: {},
                diffs:       [],
                errors:      [],
                history:     [],
                id:          null,
                name:        "Unit",
                revision:    0,
                traces:      [{
                    id:       1,
                    parent:   null,
                    end:      null,
                    error:    null,
                    guards:   0,
                    name:     "Unit::Message</test>",
                    params:   [1],
                    start:    1,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }, {
                    id:       2,
                    parent:   1,
                    end:      null,
                    error:    null,
                    guards:   0,
                    name:     "Unit::test",
                    params:   [false],
                    start:    2,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }, {
                    id:       3,
                    parent:   2,
                    end:      null,
                    error:    null,
                    guards:   0,
                    name:     "Unit::test2",
                    params:   [1],
                    start:    3,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }, {
                    id:       4,
                    parent:   3,
                    end:      null,
                    error:    null,
                    guards:   0,
                    name:     "Unit::test3",
                    params:   [2],
                    start:    4,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }, {
                    id:       5,
                    parent:   4,
                    end:      6,
                    error:    new Error("hi"),
                    guards:   0,
                    name:     "Unit::test4",
                    params:   [3],
                    start:    5,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }]
            }
        });

        const cursor7 = cursor6
            .trace("test5", Immutable.List.of(4))
            .trace.triggered()
            .trace.end();

        expect(cursor7.toJS()).to.eql({
            _unit: {
                action:      message.toJS(),
                children:    {},
                current:     0,
                description: {},
                diffs:       [],
                errors:      [],
                history:     [],
                id:          null,
                name:        "Unit",
                revision:    0,
                traces:      [{
                    id:       1,
                    parent:   null,
                    end:      null,
                    error:    null,
                    guards:   0,
                    name:     "Unit::Message</test>",
                    params:   [1],
                    start:    1,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }, {
                    id:       2,
                    parent:   1,
                    end:      null,
                    error:    null,
                    guards:   0,
                    name:     "Unit::test",
                    params:   [false],
                    start:    2,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }, {
                    id:       3,
                    parent:   2,
                    end:      null,
                    error:    null,
                    guards:   0,
                    name:     "Unit::test2",
                    params:   [1],
                    start:    3,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }, {
                    id:       4,
                    parent:   3,
                    end:      null,
                    error:    null,
                    guards:   0,
                    name:     "Unit::test3",
                    params:   [2],
                    start:    4,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }, {
                    id:       5,
                    parent:   4,
                    end:      6,
                    error:    new Error("hi"),
                    guards:   0,
                    name:     "Unit::test4",
                    params:   [3],
                    start:    5,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }, {
                    id:       6,
                    parent:   4,
                    end:      8,
                    error:    null,
                    guards:   0,
                    name:     "Unit::test5",
                    params:   [4],
                    start:    7,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }]
            }
        });

        const cursor8 = cursor7.trace.end();

        expect(cursor8.toJS()).to.eql({
            _unit: {
                action:      message.toJS(),
                children:    {},
                current:     0,
                description: {},
                diffs:       [],
                errors:      [],
                history:     [],
                id:          null,
                name:        "Unit",
                revision:    0,
                traces:      [{
                    id:       1,
                    parent:   null,
                    end:      null,
                    error:    null,
                    guards:   0,
                    name:     "Unit::Message</test>",
                    params:   [1],
                    start:    1,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }, {
                    id:       2,
                    parent:   1,
                    end:      null,
                    error:    null,
                    guards:   0,
                    name:     "Unit::test",
                    params:   [false],
                    start:    2,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }, {
                    id:       3,
                    parent:   2,
                    end:      null,
                    error:    null,
                    guards:   0,
                    name:     "Unit::test2",
                    params:   [1],
                    start:    3,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }, {
                    id:       4,
                    parent:   3,
                    end:      9,
                    error:    null,
                    guards:   0,
                    name:     "Unit::test3",
                    params:   [2],
                    start:    4,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }, {
                    id:       5,
                    parent:   4,
                    end:      6,
                    error:    new Error("hi"),
                    guards:   0,
                    name:     "Unit::test4",
                    params:   [3],
                    start:    5,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }, {
                    id:       6,
                    parent:   4,
                    end:      8,
                    error:    null,
                    guards:   0,
                    name:     "Unit::test5",
                    params:   [4],
                    start:    7,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }]
            }
        });

        const cursor9 = cursor8.trace.error(new Error("lulu"));

        expect(cursor9.toJS()).to.eql({
            _unit: {
                action:      message.toJS(),
                children:    {},
                current:     0,
                description: {},
                diffs:       [],
                errors:      [],
                history:     [],
                id:          null,
                name:        "Unit",
                revision:    0,
                traces:      [{
                    id:       1,
                    parent:   null,
                    end:      null,
                    error:    null,
                    guards:   0,
                    name:     "Unit::Message</test>",
                    params:   [1],
                    start:    1,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }, {
                    id:       2,
                    parent:   1,
                    end:      null,
                    error:    null,
                    guards:   0,
                    name:     "Unit::test",
                    params:   [false],
                    start:    2,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }, {
                    id:       3,
                    parent:   2,
                    end:      10,
                    error:    new Error("huhu"),
                    guards:   0,
                    name:     "Unit::test2",
                    params:   [1],
                    start:    3,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }, {
                    id:       4,
                    parent:   3,
                    end:      9,
                    error:    null,
                    guards:   0,
                    name:     "Unit::test3",
                    params:   [2],
                    start:    4,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }, {
                    id:       5,
                    parent:   4,
                    end:      6,
                    error:    new Error("hi"),
                    guards:   0,
                    name:     "Unit::test4",
                    params:   [3],
                    start:    5,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }, {
                    id:       6,
                    parent:   4,
                    end:      8,
                    error:    null,
                    guards:   0,
                    name:     "Unit::test5",
                    params:   [4],
                    start:    7,
                    traces:   [],
                    triggers: true,
                    locked:   false,
                    trigger:  null
                }]
            }
        });

        const cursor10 = cursor9
            .trace.end()
            .messageProcessed();

        expect(cursor10.toJS()).to.eql({
            _unit: {
                action:      null,
                children:    {},
                current:     0,
                description: {},
                diffs:       [],
                errors:      [],
                history:     [],
                id:          null,
                name:        "Unit",
                revision:    0,
                traces:      [{
                    id:       1,
                    parent:   null,
                    end:      12,
                    error:    null,
                    guards:   0,
                    name:     "Unit::Message</test>",
                    params:   [1],
                    start:    1,
                    locked:   true,
                    triggers: true,
                    trigger:  null,
                    traces:   [{
                        id:       2,
                        parent:   1,
                        locked:   true,
                        triggers: true,
                        end:      11,
                        error:    null,
                        guards:   0,
                        name:     "Unit::test",
                        params:   [false],
                        start:    2,
                        trigger:  null,
                        traces:   [{
                            id:       3,
                            parent:   2,
                            end:      10,
                            error:    new Error("lulu"),
                            guards:   0,
                            name:     "Unit::test2",
                            params:   [1],
                            start:    3,
                            triggers: true,
                            locked:   true,
                            trigger:  null,
                            traces:   [{
                                id:       4,
                                parent:   3,
                                end:      9,
                                error:    null,
                                guards:   0,
                                name:     "Unit::test3",
                                params:   [2],
                                start:    4,
                                triggers: true,
                                locked:   true,
                                trigger:  null,
                                traces:   [{
                                    id:       5,
                                    parent:   4,
                                    end:      6,
                                    error:    new Error("hi"),
                                    guards:   0,
                                    name:     "Unit::test4",
                                    params:   [3],
                                    start:    5,
                                    triggers: true,
                                    traces:   [],
                                    locked:   true,
                                    trigger:  null
                                }, {
                                    id:       6,
                                    parent:   4,
                                    end:      8,
                                    error:    null,
                                    guards:   0,
                                    name:     "Unit::test5",
                                    params:   [4],
                                    start:    7,
                                    triggers: true,
                                    traces:   [],
                                    locked:   true,
                                    trigger:  null
                                }]
                            }]
                        }]
                    }]
                }]
            }
        });

        expect(cursor10.get("_unit").get("traces").first().toString()).to.equal("                                          \u001b[7m\u001b[32m Unit::Message</test>(1) - \u001b[39m\u001b[27m\u001b[7m\u001b[32m11ms\u001b[39m\u001b[27m\u001b[7m\u001b[32m \u001b[39m\u001b[27m\n                                                                                      |\n                                             \u001b[7m\u001b[32m Unit::test(false) - \u001b[39m\u001b[27m\u001b[7m\u001b[32m9ms\u001b[39m\u001b[27m\u001b[7m\u001b[32m \u001b[39m\u001b[27m\n                                                                                      |\n                                          \u001b[7m\u001b[31m #ERROR Unit::test2(1) - \u001b[39m\u001b[27m\u001b[7m\u001b[31m7ms\u001b[39m\u001b[27m\u001b[7m\u001b[31m # \u001b[39m\u001b[27m\n                                                                                      |\n                                               \u001b[7m\u001b[32m Unit::test3(2) - \u001b[39m\u001b[27m\u001b[7m\u001b[32m5ms\u001b[39m\u001b[27m\u001b[7m\u001b[32m \u001b[39m\u001b[27m____\n                                              /                                                                                   \\\n  \u001b[7m\u001b[31m #ERROR Unit::test4(3) - \u001b[39m\u001b[27m\u001b[7m\u001b[31m1ms\u001b[39m\u001b[27m\u001b[7m\u001b[31m # \u001b[39m\u001b[27m  \u001b[7m\u001b[32m Unit::test5(4) - \u001b[39m\u001b[27m\u001b[7m\u001b[32m1ms\u001b[39m\u001b[27m\u001b[7m\u001b[32m \u001b[39m\u001b[27m");
    });

    it("creates some cursors", function() {
        const action = new Action("Test", "blub", Immutable.List(), () => 4);
        const map    = Immutable.fromJS({
            _unit: new Internals({
                description: Immutable.Map({
                    blub: action
                })
            }),
            test: "test"
        });
        const InteritedCursor = Cursor.for(class Test {}, map.get("_unit").description);
        const cursor          = new InteritedCursor(map);
        const cursor2         = new InteritedCursor(cursor);
        const spy             = sinon.spy();

        cursor.generic(spy);

        expect(cursor.size).to.equal(2);
        expect(cursor.map).to.be.a("function");
        expect(spy.calledWith(cursor)).to.equal(true, "spy should be called with initial map");
        expect(cursor.blubo).to.equal(undefined); // eslint-disable-line
        expect(() => {
            cursor.x = "huhu";
        }).to.throw();
        expect(cursor).to.equal(cursor2);
        expect(cursor.blub).to.be.a("function");
        // expect(cursor.blub()).to.equal(4);
    });

    it("errors with a cursor", function() {
        const message = new Message("/test", [1]);
        const func = function(a) {
            return this.get("test").length + 2 + a;
        };
        const action = new Action("Test", "blub", Immutable.List(), func);

        action.func = func;

        const data = Immutable.fromJS({
            _unit: (new Internals({
                name:        "Unit",
                description: Immutable.Map()
            })).messageReceived(message),
            test: "test"
        });
        const UnitCursor = Cursor.for(new (class Unit {})(), data.get("_unit").description);
        const cursor     = new UnitCursor(data);

        cursor.trace("/error", Immutable.List());

        const cursor2 = cursor.error(new Error("huhu"));

        expect(cursor.currentError).to.equal(null);
        expect(cursor.hasErrored).to.equal(false);
        expect(cursor2.hasErrored).to.equal(true);
        expect(cursor2.errors.toJS()).to.eql([new Error("huhu")]);
        expect(cursor2.currentError).to.eql(new Error("huhu"));
    });

    it("patches and diffs with a cursor", function() {
        const data = Immutable.fromJS({
            _unit: (new Internals({
                name:        "Unit",
                description: Immutable.Map()
            })),
            test: "test"
        });
        const UnitCursor = Cursor.for(new (class Unit {})(), data.get("_unit").description);
        const cursor     = new UnitCursor(data);
        const cursor2    = cursor.set("blub", 2).update("test", x => x.concat("."));

        expect(cursor.diff(cursor).toJS()).to.eql([]);
        expect(cursor.diff(cursor2).toJS()).to.eql([{
            op:    "replace",
            path:  "/test",
            value: "test."
        }, {
            op:    "add",
            path:  "/blub",
            value: 2
        }]);
        expect(cursor.patch(cursor.diff(cursor2)).toJS()).to.eql(cursor2.toJS());
    });
});
