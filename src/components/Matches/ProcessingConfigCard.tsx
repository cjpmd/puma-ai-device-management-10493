import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Settings2, RefreshCw } from 'lucide-react';

export interface ProcessingConfig {
  output_resolution: string;
  follow_mode: string;
  zoom_level: number;
  smooth_factor: number;
  output_fps: number;
}

const DEFAULT_CONFIG: ProcessingConfig = {
  output_resolution: '1920x1080',
  follow_mode: 'ball',
  zoom_level: 1.5,
  smooth_factor: 0.85,
  output_fps: 30,
};

interface ProcessingConfigCardProps {
  onTrigger: (config: ProcessingConfig) => void;
  disabled?: boolean;
}

const ProcessingConfigCard = ({ onTrigger, disabled }: ProcessingConfigCardProps) => {
  const [config, setConfig] = useState<ProcessingConfig>(DEFAULT_CONFIG);

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          Processing Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Follow Mode */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Follow Mode</Label>
          <RadioGroup
            value={config.follow_mode}
            onValueChange={(v) => setConfig((c) => ({ ...c, follow_mode: v }))}
            className="flex gap-4"
          >
            {[
              { value: 'ball', label: 'Ball', desc: 'Track the ball' },
              { value: 'player', label: 'Player', desc: 'Follow a key player' },
              { value: 'auto', label: 'Auto', desc: 'AI decides framing' },
            ].map((opt) => (
              <label
                key={opt.value}
                className="flex items-start gap-2 cursor-pointer rounded-md border border-border p-3 flex-1 hover:bg-accent transition-colors data-[state=checked]:border-primary"
              >
                <RadioGroupItem value={opt.value} className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-xs text-muted-foreground">{opt.desc}</div>
                </div>
              </label>
            ))}
          </RadioGroup>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Output Resolution */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Output Resolution</Label>
            <Select
              value={config.output_resolution}
              onValueChange={(v) => setConfig((c) => ({ ...c, output_resolution: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1280x720">720p (1280×720)</SelectItem>
                <SelectItem value="1920x1080">1080p (1920×1080)</SelectItem>
                <SelectItem value="2560x1440">1440p (2560×1440)</SelectItem>
                <SelectItem value="3840x2160">4K (3840×2160)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Output FPS */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Output FPS</Label>
            <Select
              value={String(config.output_fps)}
              onValueChange={(v) => setConfig((c) => ({ ...c, output_fps: Number(v) }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">24 fps</SelectItem>
                <SelectItem value="30">30 fps</SelectItem>
                <SelectItem value="60">60 fps</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Zoom Level */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-sm font-medium">Zoom Level</Label>
            <span className="text-xs text-muted-foreground">{config.zoom_level.toFixed(1)}×</span>
          </div>
          <Slider
            value={[config.zoom_level]}
            onValueChange={([v]) => setConfig((c) => ({ ...c, zoom_level: v }))}
            min={1}
            max={3}
            step={0.1}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Wide (1×)</span>
            <span>Tight (3×)</span>
          </div>
        </div>

        {/* Smooth Factor */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-sm font-medium">Camera Smoothing</Label>
            <span className="text-xs text-muted-foreground">{Math.round(config.smooth_factor * 100)}%</span>
          </div>
          <Slider
            value={[config.smooth_factor]}
            onValueChange={([v]) => setConfig((c) => ({ ...c, smooth_factor: v }))}
            min={0.5}
            max={0.99}
            step={0.01}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Responsive</span>
            <span>Smooth</span>
          </div>
        </div>

        {/* Trigger Button */}
        <Button onClick={() => onTrigger(config)} disabled={disabled} className="w-full">
          <RefreshCw className="h-4 w-4 mr-2" />
          Start Processing
        </Button>
      </CardContent>
    </Card>
  );
};

export default ProcessingConfigCard;
