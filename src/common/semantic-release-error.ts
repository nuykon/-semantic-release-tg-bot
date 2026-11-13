class SemanticReleaseError extends Error {
    code: string;
    details: string;
    semanticRelease = true;
    constructor(message: string, code: string, details: string) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'SemanticReleaseError';
    }
}

export {SemanticReleaseError};
