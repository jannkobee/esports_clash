<?php
namespace App\Http\Controllers;
use App\Services\ReportDeletionService;
use Illuminate\Http\Request;
class ReportDeletionController extends Controller {
    private const MESSAGE='Report details cleared from the dashboard. Worker artifacts, model files, release metadata and balance decisions are managed separately.';
    public function destroy(Request $request,string $type,string $id,ReportDeletionService $service){
        $service->delete($type,[$id]);
        $route=match($type){'ml'=>'evolution.reports','generation'=>'trellis.index','preparation'=>'preparations.index',default=>'avatars.reports'};
        return redirect()->route($route)->with('status',self::MESSAGE);
    }
    public function bulkPreparations(Request $request,ReportDeletionService $service){
        $input=$request->validate(['ids'=>'required|array|min:1|max:100','ids.*'=>'required|uuid|distinct','confirm'=>'accepted']);
        try { $service->delete('preparation',$input['ids']); }
        catch(\Illuminate\Database\Eloquent\ModelNotFoundException) {
            throw \Illuminate\Validation\ValidationException::withMessages(['report'=>'A selected report is no longer available. Refresh the list and select again. Nothing in this selection was deleted.']);
        }
        return redirect()->route('preparations.index')->with('status',count($input['ids']).' preparation reports deleted. '.self::MESSAGE);
    }
}
