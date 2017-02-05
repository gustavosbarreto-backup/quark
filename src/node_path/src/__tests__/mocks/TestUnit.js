import DeclaredAction from "../../domain/DeclaredAction";
import Runtime from "../../Runtime";

const triggered = DeclaredAction.triggered;

export default class TestUnit extends Runtime {
    static triggers = {
        action: triggered
            .by("message")
            .if((_, unit) => (
                !unit.currentMessage.willTrigger("init") &&
                unit.currentMessage.isAction()
            )),

        children: triggered
            .by("message")
            .if((_, unit) => unit.currentMessage.willTrigger("props", "action", "init")),

        diffs: triggered
            .by("message")
            .if((_, unit) => unit.currentMessage.isDiff()),

        props: triggered.by("message.done")
    };
}

