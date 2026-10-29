import subprocess
import unittest
from unittest.mock import MagicMock, patch
from colab_transport import execute, ColabTransportError


class BoundedColabControlTests(unittest.TestCase):
    def process(self):
        process = MagicMock(pid=14567, returncode=0)
        process.communicate.return_value = ('CLOUD_RESPONSE=ok\n', '')
        return process

    def test_success_cleans_up_the_owned_cli_group_after_output(self):
        process = self.process()
        with patch('colab_transport.subprocess.Popen', return_value=process) as start, patch('colab_transport.os.killpg') as kill:
            self.assertEqual(execute('colab', 'fixture-owned-session', 'print(1)', timeout=7), 'CLOUD_RESPONSE=ok\n')
        self.assertTrue(start.call_args.kwargs['start_new_session'])
        process.communicate.assert_called_once_with('print(1)', timeout=17)
        kill.assert_called_once()
        self.assertEqual(kill.call_args.args[0], 14567)
        process.wait.assert_called_once()

    def test_initial_connection_timeout_also_kills_the_cli_group(self):
        process = self.process()
        process.communicate.side_effect = subprocess.TimeoutExpired('colab', 17)
        with patch('colab_transport.subprocess.Popen', return_value=process), patch('colab_transport.os.killpg') as kill:
            with self.assertRaises(ColabTransportError):
                execute('colab', 'fixture-owned-session', 'print(1)', timeout=7)
        kill.assert_called_once()
        process.wait.assert_called_once()


if __name__ == '__main__':
    unittest.main()
