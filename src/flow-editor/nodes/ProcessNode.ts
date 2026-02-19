import { Node, NodeInterface } from "@baklavajs/core";

type Location = "left" | "right" | "top" | "bottom";

type PortMeta = {
  location: Location;
};

type PortIntf = NodeInterface<unknown> & { data?: PortMeta };

export class ProcessNode extends Node<Record<string, unknown>, Record<string, unknown>> {
  public readonly type = "ProcessNode";
  public inputs: Record<string, NodeInterface<unknown>> = {};
  public outputs: Record<string, NodeInterface<unknown>> = {};
  public details = "";

  public constructor() {
    super();
    this.title = "Process";
    (this as any).width = 440;
    (this as any).twoColumn = false;
  }

  public addInputPort(name: string, location: Location = "left"): NodeInterface<unknown> {
    return this.addPort(name, location, false);
  }

  public addOutputPort(name: string, location: Location = "right"): NodeInterface<unknown> {
    return this.addPort(name, location, true);
  }

  public addControlPort(name: string): NodeInterface<unknown> {
    return this.addPort(name, "bottom", false);
  }

  public addImpactPort(name: string): NodeInterface<unknown> {
    return this.addPort(name, "top", true);
  }

  private addPort(name: string, location: Location, isOutput: boolean): NodeInterface<unknown> {
    const key = this.makeKey(name, location, isOutput ? this.outputs : this.inputs);
    const intf = new NodeInterface<unknown>(name, null).setPort(true).setHidden(false) as PortIntf;
    intf.data = { location };

    if (isOutput) {
      this.addOutput(key, intf);
      return intf;
    }

    this.addInput(key, intf);
    return intf;
  }

  private makeKey(
    name: string,
    location: Location,
    ioCollection: Record<string, NodeInterface<unknown>>
  ): string {
    const normalized = `${location}_${name}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    let key = normalized;
    let index = 1;
    while (Object.prototype.hasOwnProperty.call(ioCollection, key)) {
      key = `${normalized}_${index}`;
      index += 1;
    }
    return key;
  }
}
