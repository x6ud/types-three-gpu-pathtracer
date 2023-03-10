declare module 'three-gpu-pathtracer' {
    import {
        BufferAttribute,
        Camera,
        Color,
        DataArrayTexture,
        DataTexture,
        InterleavedBufferAttribute,
        Light,
        Loader,
        Material,
        Matrix4,
        MeshStandardMaterial,
        Object3D,
        PerspectiveCamera,
        RectAreaLight,
        ShaderMaterial,
        SpotLight,
        Texture,
        Vector2,
        Vector4,
        WebGLArrayRenderTarget,
        WebGLRenderer,
        WebGLRenderTarget
    } from 'three';
    import {MeshBVH, MeshBVHUniformStruct, SplitStrategy, UIntVertexAttributeTexture} from 'three-mesh-bvh';

    /** Utility class for tracking and rendering a path traced scene to a render target. */
    export class PathTracingRenderer {
        /** The Path Tracing material to render. This is expected to be a full screen quad material that respects the "opacity" field for every pixel so samples can be accumulated over time. The material is also expected to have cameraWorldMatrix and invProjectionMatrix fields of type Matrix4. */
        material: PhysicalPathTracingMaterial | null;
        /** The target being rendered to. The size of the target is updated with setSize and is initialized to a FloatType texture. */
        readonly target: WebGLRenderTarget;
        /**
         * Whether to support rendering scenes with transparent backgrounds. When transparent backgrounds are used two extra render targets are used, custom blending is performed, and PathTracingRenderer.target will change on every completed sample.
         * Note: When a transparent background is used the material used for the final render to the canvas must use the same "premultipliedAlpha" setting as the canvas otherwise the final image may look incorrect.
         * */
        alpha: boolean;
        /** Number of samples per pixel that have been rendered to the target. */
        readonly samples: number;
        /** The camera to render with. The view offset of the camera will be updated every sample to enable anti aliasing. */
        camera: Camera | null;
        /** Number of tiles on x and y to render to. Can be used to improve the responsiveness of a page while still rendering a high resolution target. */
        tiles: Vector2;
        /** Whether to reset the random seed to 0 when restarting the render. If true then a consistent random sample pattern will appear when moving the camera, for example. */
        stableNoise: boolean;
        /** Whether the initial tile is reset to the top left tile when moving the camera or if it should continue to shift every frame. */
        stableTiles: boolean;

        constructor(renderer: WebGLRenderer);

        /** Sets the size of the target to render to. */
        setSize(w: number, h: number): void;

        dispose(): void;

        /** Resets and restarts the render from scratch. */
        reset(): void;

        /** Renders a single sample to the target. */
        update(): void;
    }

    /** Renderer that supports rendering to a quilt renderer to rendering on displays such as the Looking Glass display. */
    export class QuiltPathTracingRenderer extends PathTracingRenderer {
        /** The number of quilt patches in each dimension. */
        quiltDimensions: Vector2;
        /** The number of views to be rendered. If this is less than the product of the quiltDimensions then there will be gaps at the end of the quilt. */
        viewCount: number;
        /** The total angle sweep for the camera views rendered across the quilt. */
        viewCone: number;
        /** The camera field of view to render. */
        viewFoV: number;
        /** The distance of the viewer to the display. */
        displayDistance: number;
        /** The aspect ratio of the display. */
        displayAspect: number;

        /** Updates the displayDistance, displayAspect, and the viewFoV from viewer and display information. */
        setFromDisplayView(viewerDistance: number, displayWidth: number, displayHeight: number): void;
    }

    /** Utility class for generating the set of data required for initializing the path tracing material with a bvh, geometry, materials, and textures. */
    export class PathTracingSceneGenerator {
        /** Merges the geometry in the given scene with an additional "materialIndex" attribute that references the associated material array. Also produces a set of textures referenced by the scene materials. */
        generate(scene: Object3D | Object3D[], options?: {
            strategy?: SplitStrategy;
            maxDepth?: number;
            setBoundingBox?: boolean;
            useSharedArrayBuffer?: boolean;
            verbose?: boolean;
            onProgress?: (progress: number) => void;
        }): {
            scene: Object3D | Object3D[],
            materials: Material[],
            textures: Texture[],
            lights: Light[],
            bvh: MeshBVH
        };
    }

    export class PathTracingSceneWorker {
        generate(scene: Object3D | Object3D[], options?: {
            strategy?: SplitStrategy;
            maxDepth?: number;
            setBoundingBox?: boolean;
            useSharedArrayBuffer?: boolean;
            verbose?: boolean;
            onProgress?: (progress: number) => void;
        }): Promise<{
            scene: Object3D | Object3D[],
            materials: Material[],
            textures: Texture[],
            lights: Light[],
            bvh: MeshBVH
        }>;

        dispose(): void;
    }

    /**
     * A variation of the path tracing scene generator intended for quickly regenerating a scene BVH representation that updates frequently. Ie those with animated objects or animated skinned geometry.
     *
     * In order to quickly update a dynamic scene the same BVH is reused across updates by refitting rather than regenerating. This is significantly faster but also results in a less optimal BVH after significant changes.
     *
     * If geometry or materials are added or removed from the scene then reset must be called.
     **/
    export class DynamicPathTracingSceneGenerator {
        constructor(scene: Object3D[]);

        /** Resets the generator so a new BVH is generated. This must be called when geometry, objects, or materials are added or removed from the scene. */
        reset(): void;

        /** Generates and refits the bvh to the current scene state. The same bvh, materials, and textures objects are returns after the initial call until reset is called. */
        generate(): {
            lights: Light[],
            bvh: MeshBVH,
            materials: Material[],
            textures: Texture[],
            objects: Object3D[]
        };
    }

    export class MaterialReducer {
        areEqual(objectA: Object3D, objectB: Object3D): boolean;

        process(object: Object3D): { replaced: number, retained: number };
    }

    /** An extension of the js PerspectiveCamera with some other parameters associated with depth of field. These parameters otherwise do not affect the camera behavior are are for convenience of use with the PhysicalCameraUniform and pathtracer. */
    export class PhysicalCamera extends PerspectiveCamera {
        /** The bokeh size as derived from the fStop and focal length in millimeters. If this is set then the fStop is implicitly updated. */
        bokehSize: number;
        /** The fstop value of the camera. If this is changed then the bokehSize field is implicitly updated. */
        fStop: number;
        /** The number of sides / blades on the aperture. */
        apertureBlades: number;
        /** The rotation of the aperture shape in radians. */
        apertureRotation: number;
        /** The distance from the camera in meters that everything is is perfect focus. */
        focusDistance: number;
        /** The anamorphic ratio of the lens. A higher value will stretch the bokeh effect horizontally. */
        anamorphicRatio: number;
    }

    /** A class indicating that the path tracer should render an equirectangular view. Does not work with js raster rendering. */
    export class EquirectCamera extends Camera {
        isEquirectCamera: boolean;
    }

    export class PhysicalSpotLight extends SpotLight {
        /**
         * The loaded IES texture describing directional light intensity. These can be loaded with the IESLoader.
         *
         * Premade IES profiles can be downloaded from [ieslibrary.com]. And custom profiles can be generated using CNDL.
         **/
        iesTexture: Texture | null;
        /** The radius of the spotlight surface. Increase this value to add softness to shadows. */
        radius: number;
    }

    export class ShapedAreaLight extends RectAreaLight {
        /** Whether the area light should be rendered as a circle or a rectangle. */
        isCircular: boolean;
    }

    export class ProceduralEquirectTexture extends DataTexture {
        update(): void;
    }

    export class GradientEquirectTexture extends ProceduralEquirectTexture {
        topColor: Color;
        bottomColor: Color;
        exponent: number;

        constructor(resolution: number);
    }

    /** Helper texture uniform for encoding materials as texture data. */
    export class MaterialsTexture extends DataTexture {
        /** js materials support only a single set of UV transforms in a certain fallback priority while the pathtracer supports a unique set of transforms per texture. Set this field to true in order to use the same uv transform handling as js materials. */
        threeCompatibilityTransforms: boolean;

        /** Sets whether or not the material of the given index will cast shadows. When "false" materials will not cast shadows on diffuse surfaces but will still be reflected. This is a good setting for lighting enclosed interiors with environment lighting. */
        setCastShadow(materialIndex: number, cast: boolean): void;

        getCastShadow(materialIndex: number): boolean;

        /** Sets whether or not the material of the given index is matte or not. When "true" the background is rendered in place of the material. */
        setMatte(materialIndex: number, matte: boolean): void;

        getMatte(materialIndex: number): boolean;

        /**
         * Updates the size and values of the texture to align with the provided set of materials and textures.
         *
         * The "matte" and "side" values must be updated explicitly.
         *
         * Note: In order for volume transmission to work the "attenuationDistance" must be set to a value less than Infinity or "thickness" must be set to a value greater than 0.
         **/
        updateFrom(materials: Material[], textures: Texture[]): void;
    }

    /** A convenience extension from WebGLArrayRenderTarget that affords easily creating a uniform texture array from an array of textures. */
    export class RenderTarget2DArray extends WebGLArrayRenderTarget {
        texture: DataArrayTexture & {
            setTextures(renderer: WebGLRenderer, width: number, height: number, textures: Texture[]): void;
        };

        /** Takes the rendering context to update the target for, the target dimensions of the texture array, and the array of textures to render into the 2D texture array. Every texture is stretched to the dimensions of the texture array at the same index they are provided in. */
        setTextures(renderer: WebGLRenderer, width: number, height: number, textures: Texture[]): void;
    }

    /** Stores the environment map contents along with the intensity distribution information to support multiple importance sampling. */
    export class EquirectHdrInfoUniform {
        dispose(): void;

        /** Takes an environment map to process into something usable by the path tracer. Is expected to be a DataTexture so the data can be read. */
        updateFrom(hdr: Texture): void;
    }

    /** Uniform for storing the camera parameters for use with the shader. */
    export class PhysicalCameraUniform {
        /** Copies all fields from the passed PhysicalCamera if available otherwise the defaults are used. */
        updateFrom(camera: PerspectiveCamera | PhysicalCamera): void;
    }

    /** Helper uniform for encoding lights as texture data with count. */
    export class LightsInfoUniformStruct {
        /** Updates the size and values of the texture to align with the provided set of lights and IES textures. */
        updateFrom(lights: Light[], iesTextures?: Texture[]);
    }

    export class IESProfilesTexture extends WebGLArrayRenderTarget {
        updateFrom(renderer: WebGLRenderer, textures: Texture[]): Promise<void>;

        dispose(): void;
    }

    /** Utility for generating a PMREM blurred environment map that can be used with the path tracer. */
    export class BlurredEnvMapGenerator {
        constructor(renderer: WebGLRenderer);

        /** Disposes of the temporary files and textures for generation. */
        dispose(): void;

        /** Takes a texture to blur and the amount to blur it. Returns a new DataTexture that has been PMREM blurred environment map that can have distribution data generated for importance sampling. */
        generate(texture: Texture, blur: number): DataTexture;
    }

    /** Loader for loading and parsing IES profile data. Load and parse functions return a DataTexture with the profile contents. */
    export class IESLoader extends Loader {
        load(url: string,
             onLoad?: (texture: DataTexture) => void,
             onProgress?: (request: ProgressEvent) => void,
             onError?: (event: ErrorEvent) => void
        ): DataTexture;

        parse(text: string): DataTexture;
    }

    /** Convenience base class that adds additional functions and implicitly adds object definitions for all uniforms of the shader to the object. */
    export class MaterialBase extends ShaderMaterial {
        /** Sets the define of the given name to the provided value. If the value is set to null or undefined then it is deleted from the defines of the material. If the define changed from the previous value then Material.needsUpdate is set to true. */
        setDefine(name: string, value?: any): void
    }

    /** Denoise material based on BrutPitt/glslSmartDeNoise intended to be the final pass to the screen. Includes tonemapping and color space conversions. */
    export class DenoiseMaterial extends MaterialBase {
        sigma: number;
        kSigma: number;
        threshold: number;
    }

    export class GraphMaterial extends MaterialBase {
        dim: boolean;
        thickness: number;
        graphCount: number;
        graphDisplay: Vector4;
        overlay: boolean;
        xRange: Vector2;
        yRange: Vector2;
        colors: Color[];
    }

    class FloatAttributeTextureArray extends DataArrayTexture {
        updateAttribute(index: number, attr: BufferAttribute | InterleavedBufferAttribute): void;
    }

    class AttributesTextureArray extends FloatAttributeTextureArray {
        updateNormalAttribute(attr: BufferAttribute | InterleavedBufferAttribute): void;

        updateTangentAttribute(attr: BufferAttribute | InterleavedBufferAttribute): void;

        updateUvAttribute(attr: BufferAttribute | InterleavedBufferAttribute): void;

        updateColorAttribute(attr: BufferAttribute | InterleavedBufferAttribute): void;

        updateFrom(normal: BufferAttribute | InterleavedBufferAttribute,
                   tangent: BufferAttribute | InterleavedBufferAttribute,
                   uv: BufferAttribute | InterleavedBufferAttribute,
                   color: BufferAttribute | InterleavedBufferAttribute
        ): void;
    }

    export class PhysicalPathTracingMaterial extends MaterialBase {
        resolution: Vector2;
        /** The number of ray bounces to test. Higher is better quality but slower performance. */
        bounces: number;
        /** The number of additional transmissive ray bounces to allow on top of existing bounces for object opacity / transmission. */
        transmissiveBounces: number;
        physicalCamera: PhysicalCameraUniform;
        bvh: MeshBVHUniformStruct;
        attributesArray: AttributesTextureArray;
        materialIndexAttribute: UIntVertexAttributeTexture;
        materials: MaterialsTexture;
        textures: DataArrayTexture & {
            setTextures(renderer: WebGLRenderer, width: number, height: number, textures: Texture[]): void;
        };
        // @ts-ignore
        lights: LightsInfoUniformStruct;
        iesProfiles: DataArrayTexture;
        cameraWorldMatrix: Matrix4;
        invProjectionMatrix: Matrix4;
        backgroundBlur: number;
        environmentIntensity: number;
        environmentRotation: Matrix4;
        envMapInfo: EquirectHdrInfoUniform;
        backgroundMap: Texture | null;
        seed: number;
        opacity: number;
        /** Factor for alleviating bright pixels from rays that hit diffuse surfaces then specular surfaces. Setting this higher alleviates fireflies but will remove some specular caustics. */
        filterGlossyFactor: number;
        /** The transparency to render the background with. Note that the "alpha" option must be set to true on PathTracingRenderer for this field to work properly. */
        backgroundAlpha: number;
        sobolTexture: Texture | null;
    }

    /**
     * A material used for rendering fog-like volumes within the scene. The color, emissive, and emissiveIntensity fields are all used in the render.
     *
     * Note: Since fog models many particles throughout the scene and cause many extra bounces fog materials can dramatically impact render time.
     **/
    export class FogVolumeMaterial extends MeshStandardMaterial {
    }
}
