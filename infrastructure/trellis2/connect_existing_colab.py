"""Associate the sole existing T4 with a dedicated HTTP-RPC kernel; no allocation."""
from colab_cli.common import state
from colab_cli.state import SessionState


def main():
    matches = [item for item in state.client.list_assignments() if item.accelerator.value == 'T4']
    if len(matches) != 1:
        raise SystemExit('Expected one existing T4. Select the intended runtime explicitly; none was allocated.')
    item = matches[0]
    name = 'asset-quality-rpc'
    existing = state.store.get(name)
    if existing:
        if existing.endpoint != item.endpoint:
            raise SystemExit('The RPC name points to another runtime; preserve it and review the connection.')
        print('The dedicated RPC connection already exists.')
        return
    state.store.add(SessionState(name=name, endpoint=item.endpoint,
        token=item.runtime_proxy_info.token, url=item.runtime_proxy_info.url,
        token_expires_at=item.runtime_proxy_info.expires_at(),
        accelerator=item.accelerator.value, variant=item.variant.name,
        machine_shape=item.machine_shape.name))
    print('Connected the existing T4 through a dedicated RPC kernel. No runtime allocated or restarted.')


if __name__ == '__main__':
    main()
