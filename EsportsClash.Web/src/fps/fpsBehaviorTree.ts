export type BtStatus = 'success' | 'failure' | 'running';

export interface BtNode<C> {
  readonly name: string;
  tick(ctx: C): BtStatus;
}

export function btCondition<C>(name: string, pred: (ctx: C) => boolean): BtNode<C> {
  return {
    name,
    tick: (ctx) => (pred(ctx) ? 'success' : 'failure'),
  };
}

export function btAction<C>(name: string, run: (ctx: C) => BtStatus): BtNode<C> {
  return { name, tick: run };
}

export function btSelector<C>(name: string, children: readonly BtNode<C>[]): BtNode<C> {
  return {
    name,
    tick: (ctx) => {
      for (let i = 0; i < children.length; i++) {
        const status = children[i].tick(ctx);
        if (status !== 'failure') return status;
      }
      return 'failure';
    },
  };
}

export function btSequence<C>(name: string, children: readonly BtNode<C>[]): BtNode<C> {
  return {
    name,
    tick: (ctx) => {
      for (let i = 0; i < children.length; i++) {
        const status = children[i].tick(ctx);
        if (status !== 'success') return status;
      }
      return 'success';
    },
  };
}

export function tickBt<C>(root: BtNode<C>, ctx: C): BtStatus {
  return root.tick(ctx);
}

export interface FpsUtilityPrepBtHandlers<C> {
  hasPrep(ctx: C): boolean;
  shouldCancelForDanger(ctx: C): boolean;
  cancelPrep(ctx: C): void;
  isReadyToRelease(ctx: C): boolean;
  aimAndPullPin(ctx: C): void;
  releasePrep(ctx: C): void;
}

/** Modular Behavior Tree coordinating grenade draw, audible pin-pull timing, abort-on-contact, and release. */
export function createUtilityPrepBt<C>(handlers: FpsUtilityPrepBtHandlers<C>): BtNode<C> {
  return btSequence('utility-prep-root', [
    btCondition('has-utility-prep', handlers.hasPrep),
    btSelector('utility-prep-branch', [
      btSequence('abort-under-danger', [
        btCondition('danger-cancel', handlers.shouldCancelForDanger),
        btAction('cancel-utility-prep', (ctx) => {
          handlers.cancelPrep(ctx);
          return 'success';
        }),
      ]),
      btSequence('release-when-ready', [
        btCondition('prep-ready', handlers.isReadyToRelease),
        btAction('release-utility', (ctx) => {
          handlers.releasePrep(ctx);
          return 'success';
        }),
      ]),
      btAction('hold-aim-and-pull-pin', (ctx) => {
        handlers.aimAndPullPin(ctx);
        return 'running';
      }),
    ]),
  ]);
}

export interface FpsDuelMicroBtHandlers<C> {
  hasTarget(ctx: C): boolean;
  shouldTurnAwayFromFlash(ctx: C): boolean;
  turnAwayFromFlash(ctx: C): void;
  isReacting(ctx: C): boolean;
  handleReactionWait(ctx: C): void;
  shouldReloadOrSwapSidearm(ctx: C): boolean;
  handleReloadOrSidearm(ctx: C): void;
  shouldHoldTriggerDiscipline(ctx: C): boolean;
  handleTriggerDiscipline(ctx: C): void;
  shouldHoldOrRepositionCover(ctx: C): boolean;
  handleCoverOrReposition(ctx: C): void;
  stepCombatStrafe(ctx: C): void;
  aimAndFire(ctx: C): void;
}

/** Modular Behavior Tree governing tactical duel micro-actions once an enemy target is acquired. */
export function createDuelMicroBt<C>(handlers: FpsDuelMicroBtHandlers<C>): BtNode<C> {
  return btSequence('duel-micro-root', [
    btCondition('has-target', handlers.hasTarget),
    btSelector('duel-micro-select', [
      btSequence('flash-turn-away', [
        btCondition('needs-flash-turn-away', handlers.shouldTurnAwayFromFlash),
        btAction('exec-flash-turn-away', (ctx) => {
          handlers.turnAwayFromFlash(ctx);
          return 'running';
        }),
      ]),
      btSequence('reaction-delay-wait', [
        btCondition('is-reacting', handlers.isReacting),
        btAction('exec-reaction-wait', (ctx) => {
          handlers.handleReactionWait(ctx);
          return 'running';
        }),
      ]),
      btSequence('reload-or-sidearm-swap', [
        btCondition('needs-reload-or-sidearm', handlers.shouldReloadOrSwapSidearm),
        btAction('exec-reload-or-sidearm', (ctx) => {
          handlers.handleReloadOrSidearm(ctx);
          return 'running';
        }),
      ]),
      btSequence('trigger-discipline-hold', [
        btCondition('needs-trigger-discipline', handlers.shouldHoldTriggerDiscipline),
        btAction('exec-trigger-discipline', (ctx) => {
          handlers.handleTriggerDiscipline(ctx);
          return 'running';
        }),
      ]),
      btSequence('cover-or-reposition', [
        btCondition('needs-cover-or-reposition', handlers.shouldHoldOrRepositionCover),
        btAction('exec-cover-or-reposition', (ctx) => {
          handlers.handleCoverOrReposition(ctx);
          return 'running';
        }),
      ]),
      btAction('strafe-aim-and-fire', (ctx) => {
        handlers.stepCombatStrafe(ctx);
        handlers.aimAndFire(ctx);
        return 'running';
      }),
    ]),
  ]);
}
