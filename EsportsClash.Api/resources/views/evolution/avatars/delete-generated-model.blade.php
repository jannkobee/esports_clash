<form method="post" action="{{ route('trellis.destroy-model',$model) }}" onsubmit="return confirm('Are you sure you want to permanently delete this generated 3D model? This cannot be undone. Its report and reference image are kept. You can generate a replacement manually.');">
@csrf @method('DELETE')<input type="hidden" name="confirm_delete" value="1"><button class="danger" type="submit">Delete generated model</button>
</form>
