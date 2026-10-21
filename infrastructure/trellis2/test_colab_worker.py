"""The Colab helper exposes only bounded native TRELLIS.2 operations."""
import unittest
from unittest.mock import patch
from colab_worker import request


class ColabAdapterTests(unittest.TestCase):
    def test_unprovisioned_runtime_is_not_ready(self):
        with patch('colab_worker.Path.is_file',return_value=False):
            result=request('GET','/operations')
        self.assertIn('not been provisioned',result['transport_error'])

    def test_arbitrary_urls_and_paths_are_rejected(self):
        for method,path in [('GET','http://example.com'),('GET','/../../etc/passwd'),('POST','/exec'),('DELETE','/operations')]:
            with self.subTest(path=path),self.assertRaises(ValueError):request(method,path)

    def test_offline_native_service_is_not_reported_as_a_gpu_success(self):
        with patch('colab_worker.Path.is_file',return_value=True),patch('colab_worker.Path.read_text',return_value='test-only'), \
             patch('colab_worker.urllib.request.urlopen',side_effect=OSError('offline')):
            result=request('GET','/operations')
        self.assertIn('offline',result['transport_error'])


if __name__=='__main__':unittest.main()
