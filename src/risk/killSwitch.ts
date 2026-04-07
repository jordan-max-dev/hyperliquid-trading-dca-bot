export class KillSwitch {
  private halted = false;
  private reason = "not triggered";

  trigger(reason: string): void {
    this.halted = true;
    this.reason = reason;
  }

  clear(): void {
    this.halted = false;
    this.reason = "not triggered";
  }

  getStatus(): { halted: boolean; reason: string } {
    return {
      halted: this.halted,
      reason: this.reason,
    };
  }
}
